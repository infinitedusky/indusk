import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readApp } from "../lib/looks/mockups.js";
import { REPO_ROOT, runCli } from "./helpers/cli.js";

/**
 * promise: a-component-has-one-implementation — storybook-components A2.
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
