import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addApprovedMockup, app, MOCKUPS, removeApps } from "../../__tests__/helpers/looks-cli.js";
import { readApprovals } from "./approvals.js";
import { coverageOf } from "./coverage.js";
import { planHasLanded } from "./landed.js";
import { componentOfStory, readApp } from "./mockups.js";

// promise: a-component-has-one-implementation
// promise: the-everyday-suite-passes-on-main
const roots: string[] = [];
afterEach(() => {
	removeApps();
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function project(...folders: string[]): string {
	const root = mkdtempSync(join(tmpdir(), "landed-"));
	roots.push(root);
	for (const f of folders) mkdirSync(join(root, ".indusk", "planning", f), { recursive: true });
	return root;
}

describe("planHasLanded", () => {
	it("an active folder not archived has not landed", () => {
		expect(planHasLanded(project("x"), "x")).toBe(false);
	});
	it("an archived folder has landed, even if an active copy remains", () => {
		expect(planHasLanded(project("archive/x"), "x")).toBe(true);
		expect(planHasLanded(project("x", "archive/x"), "x")).toBe(true);
	});
	it("a plan with no folder reads landed, so legacy records stay strictly checked", () => {
		expect(planHasLanded(project(), "ghost")).toBe(true);
	});
});

describe("A10 — a re-approval in flight keeps holding the components a landed approval bound", () => {
	it("reports plan-row, bound by the landed approval, and not ghost-row, which only the active re-approval adds", async () => {
		const root = app();
		await addApprovedMockup(root, {
			screen: "rows",
			markup:
				'<main class="card" data-component="plan-row"><p data-component="ghost-row">A ghost.</p></main>',
			approvals: [
				{
					at: "2026-10-01T09:00:00.000Z",
					plan: "landed-plan",
					components: { "plan-row.open": "h1" },
				},
				{ at: "2026-10-14T09:00:00.000Z", plan: "active-plan" },
			],
		});
		mkdirSync(join(root, ".indusk", "planning", "archive", "landed-plan"), { recursive: true });
		mkdirSync(join(root, ".indusk", "planning", "active-plan"), { recursive: true });
		const looks = await readApp(root, "demo");

		const coverage = await coverageOf(root, looks, readApprovals(looks));
		expect(coverage.unimplemented).toContain("plan-row");
		expect(coverage.unimplemented).not.toContain("ghost-row");
	});
});

describe("A11 — a story name's component is read by one rule", () => {
	it("is the name before the first dot, however many dots follow", () => {
		expect(componentOfStory("plan-row.open")).toBe("plan-row");
		expect(componentOfStory("plan-row.open.wide")).toBe("plan-row");
	});

	it("is the component the story reader reports", async () => {
		const root = app();
		const components = join(root, MOCKUPS, "components");
		mkdirSync(components, { recursive: true });
		writeFileSync(join(components, "plan-row.open.html"), "<div></div>");
		writeFileSync(join(components, "plan-row.open.wide.html"), "<div></div>");
		const looks = await readApp(root, "demo");
		expect(looks.stories.map((s) => s.name)).toEqual(["plan-row.open", "plan-row.open.wide"]);
		for (const story of looks.stories) expect(story.component).toBe(componentOfStory(story.name));
	});
});
