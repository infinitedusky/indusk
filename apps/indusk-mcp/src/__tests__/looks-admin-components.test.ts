import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readApp } from "../lib/looks/mockups.js";
import { REPO_ROOT, runCli } from "./helpers/cli.js";
import { app, MOCKUPS, removeApps, run } from "./helpers/looks-cli.js";

/**
 * promise: a-component-has-one-implementation — storybook-components A2.
 * promise: the-everyday-suite-passes-on-main — main-suite-green A8 (second describe).
 *
 * Every component the admin's approved mockups name has an implementation in
 * the admin; one with none is reported by name. The names are read from the
 * mockups *composed* (`readApp`: each `<indusk-component>` replaced by its
 * snapshot, so a component a snapshot nests is named too), as the lint, the
 * check and coverage read them — not from the mockups' source, which after
 * Build Phase 6 names thirteen and draws the rest only through snapshots. An
 * implementation is a non-test, non-story file under `apps/indusk-admin/src`
 * whose element carries that `data-component`.
 *
 * Two assertions: the CLI's `unimplemented component: <name>` lines are
 * exactly the components with no implementation (red today: the line does not
 * exist and ten are unmarked), and none is left (red until Build Phase 5).
 */

const ADMIN_SRC = join(REPO_ROOT, "apps/indusk-admin/src");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

/** The component names the admin's mockups name, composed, sorted. */
async function mockupComponents(): Promise<string[]> {
	const names = new Set<string>();
	for (const mockup of (await readApp(REPO_ROOT, "admin")).mockups) {
		for (const m of mockup.html.matchAll(/\bdata-component\s*=\s*["']([^"']+)["']/g)) {
			names.add(m[1]);
		}
	}
	return [...names].sort();
}

/** The components the admin's source implements: a marker in a file that is neither a test nor a story. */
function implemented(): Set<string> {
	const names = new Set<string>();
	for (const file of walk(ADMIN_SRC)) {
		if (!/\.(tsx|jsx)$/.test(file) || /\.(test|stories)\./.test(file)) continue;
		if (file.includes("__tests__")) continue;
		const text = readFileSync(file, "utf-8");
		for (const m of text.matchAll(/\bdata-component\s*=\s*\{?\s*["'`]([^"'`\s]+)["'`]/g)) {
			names.add(m[1]);
		}
	}
	return names;
}

describe("the admin implements every component its mockups name", () => {
	it("A2 each of the mockups' components has an implementation; one with none is reported by name", async () => {
		const named = await mockupComponents();
		// Not a count: the mockups name what they place, and which components
		// those are is the mockups' to change; coverage reports a component
		// none of them shows. An empty read would pass for the wrong reason.
		expect(named.length, "the admin's mockups name components").toBeGreaterThan(0);
		const have = implemented();
		const missing = named.filter((n) => !have.has(n));

		const { stdout, stderr } = runCli(REPO_ROOT, ["looks", "coverage", "admin"]);
		const reported = `${stdout}\n${stderr}`
			.split("\n")
			.map((l) => l.match(/unimplemented component:\s*(\S+)/)?.[1])
			.filter((n): n is string => n !== undefined)
			.sort();

		expect(
			reported,
			`coverage must report each component with no implementation by name; ${missing.length} have none: ${missing.join(", ")}`,
		).toEqual(missing);
		expect(missing, "components the mockups name with no implementation in the admin").toEqual([]);
	});
});

/**
 * main-suite-green A8 — the check holds only looks whose plan has landed.
 *
 * Approval merges a plan's mockups to main before any code, so a component
 * only an unlanded plan's mockup names cannot exist yet. Through the CLI
 * (`indusk looks coverage`), the way the check reads it: a fixture app whose
 * one approved mockup names `ghost-row`, the approval recorded under a plan
 * that is either active or archived under `.indusk/planning/`.
 */
describe("A8 — a component an unlanded plan's mockup names is not unimplemented", () => {
	afterEach(removeApps);

	const GHOST = "unimplemented component: ghost-row";

	/** The fixture app plus an approved mockup naming `ghost-row`, approved in `plan`, whose folder is at `planFolder`. */
	async function appWithGhost(planFolder: string): Promise<string> {
		const root = app();
		const mockups = join(root, MOCKUPS);
		const screens = JSON.parse(readFileSync(join(mockups, "screens.json"), "utf-8"));
		screens.screens.push({ name: "ghost", states: ["default"] });
		writeFileSync(join(mockups, "screens.json"), JSON.stringify(screens));
		const html = readFileSync(join(mockups, "screens/home.empty.html"), "utf-8").replace(
			'<main class="card" data-component="card">Nothing here yet.</main>',
			'<main class="card" data-component="ghost-row">A ghost.</main>',
		);
		writeFileSync(join(mockups, "screens/ghost.default.html"), html);

		const looks = await readApp(root, "demo");
		const ghost = looks.mockups.find((m) => m.name === "ghost.default");
		if (!ghost) throw new Error("the fixture's ghost mockup was not read");
		const record = JSON.parse(readFileSync(join(mockups, "approved.json"), "utf-8"));
		record.approvals.push({
			mockup: "ghost.default",
			mockupHash: ghost.hash,
			foundationHash: looks.foundation.hash,
			declarationsHash: looks.declarationsHash,
			by: "sandy",
			at: "2026-10-14T09:00:00.000Z",
			plan: "ghost-plan",
		});
		writeFileSync(join(mockups, "approved.json"), JSON.stringify(record));

		const brief = join(root, planFolder, "brief.md");
		mkdirSync(dirname(brief), { recursive: true });
		writeFileSync(brief, "---\ntitle: ghost-plan\n---\n");
		return root;
	}

	it("is not reported while the plan that approved it is active", async () => {
		const root = await appWithGhost(".indusk/planning/ghost-plan");
		const { out } = run(root, ["coverage", "demo"]);
		expect(out).not.toContain(GHOST);
	});

	it("is reported once the plan is archived and the component is still missing", async () => {
		const root = await appWithGhost(".indusk/planning/archive/ghost-plan");
		const { out } = run(root, ["coverage", "demo"]);
		expect(out).toContain(GHOST);
	});
});
