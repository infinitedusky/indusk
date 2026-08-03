import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseAllPlans, readPlanDeclarations } from "../plan-parser.js";

/**
 * T6–T9 — the "grouping never hides a plan" guards.
 *
 * Plan hierarchy is declared top-down: the root `master.md` names `parents:`
 * and the `roadmap:` order; each parent's own `master.md` names its ordered
 * `subplans:`. Children declare nothing. The inventory of plans always comes
 * from disk, never from a list — these tests pin that a declaration can add
 * structure but can never subtract a plan.
 */

let root: string;
let planning: string;

/** A plan folder with a minimal brief so the parser recognises it. */
function makePlan(name: string, docs: Record<string, string> = {}): void {
	const dir = join(planning, name);
	mkdirSync(dir, { recursive: true });
	const files = Object.keys(docs).length > 0 ? docs : { "brief.md": brief(name) };
	for (const [file, body] of Object.entries(files)) {
		writeFileSync(join(dir, file), body, "utf8");
	}
}

function brief(name: string): string {
	return `---\ntitle: "${name}"\ndate: 2026-08-02\nstatus: accepted\n---\n\n# ${name}\n`;
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "declarations-"));
	planning = join(root, ".indusk", "planning");
	mkdirSync(planning, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("T6 — a broken declaration degrades to the flat list", () => {
	it("returns empty declarations when the root master is missing entirely", () => {
		makePlan("alpha");
		makePlan("beta");

		const declarations = readPlanDeclarations(planning);

		expect(declarations.parents).toEqual([]);
		expect(declarations.roadmap).toEqual([]);
		expect(declarations.subplans).toEqual({});
		// The plans themselves are untouched by the absent declaration.
		expect(parseAllPlans(root).map((p) => p.name).sort()).toEqual(["alpha", "beta"]);
	});

	it("survives malformed YAML in a master file without throwing", () => {
		makePlan("alpha");
		writeFileSync(join(planning, "master.md"), "---\nparents: [unclosed\n---\n", "utf8");

		expect(() => readPlanDeclarations(planning)).not.toThrow();
		const declarations = readPlanDeclarations(planning);
		expect(declarations.parents).toEqual([]);
		expect(parseAllPlans(root).map((p) => p.name)).toContain("alpha");
	});

	it("treats a parent whose master has no subplans key as having no children", () => {
		makePlan("parent-plan", { "master.md": `---\ntitle: "parent"\n---\n\n# parent\n` });
		writeFileSync(join(planning, "master.md"), "---\nparents: [parent-plan]\n---\n", "utf8");

		const declarations = readPlanDeclarations(planning);

		expect(declarations.parents).toEqual(["parent-plan"]);
		expect(declarations.subplans["parent-plan"] ?? []).toEqual([]);
	});
});

describe("T7 — every plan on disk is accounted for", () => {
	it("never drops a plan that no declaration mentions", () => {
		makePlan("declared-parent", {
			"master.md": `---\nsubplans: [declared-child]\n---\n\n# parent\n`,
		});
		makePlan("declared-child");
		makePlan("mentioned-by-nobody");
		writeFileSync(
			join(planning, "master.md"),
			"---\nparents: [declared-parent]\nroadmap: [declared-parent]\n---\n",
			"utf8",
		);

		const names = parseAllPlans(root).map((p) => p.name).sort();

		expect(names).toEqual(["declared-child", "declared-parent", "mentioned-by-nobody"]);
	});

	it("reports a declared subplan that does not exist on disk without inventing a plan", () => {
		makePlan("parent-plan", {
			"master.md": `---\nsubplans: [real-child, not-yet-created]\n---\n\n# parent\n`,
		});
		makePlan("real-child");

		const declarations = readPlanDeclarations(planning);
		const names = parseAllPlans(root).map((p) => p.name).sort();

		// The declaration names both; only the real one is a plan on disk. The
		// difference is what the UI renders as a placeholder.
		expect(declarations.subplans["parent-plan"]).toEqual(["real-child", "not-yet-created"]);
		expect(names).toEqual(["parent-plan", "real-child"]);
	});
});

describe("T8 — a parent with no children is an ordinary plan", () => {
	it("declares the parent but gives it an empty child list", () => {
		makePlan("lonely-parent", { "master.md": `---\nsubplans: []\n---\n\n# lonely\n` });
		writeFileSync(join(planning, "master.md"), "---\nparents: [lonely-parent]\n---\n", "utf8");

		const declarations = readPlanDeclarations(planning);

		expect(declarations.parents).toEqual(["lonely-parent"]);
		expect(declarations.subplans["lonely-parent"] ?? []).toEqual([]);
	});
});

describe("T9 — the plan list itself is unchanged by declarations", () => {
	it("returns identical plan summaries with and without declarations present", () => {
		makePlan("alpha");
		makePlan("beta");
		const before = parseAllPlans(root);

		writeFileSync(
			join(planning, "master.md"),
			"---\nparents: [alpha]\nroadmap: [alpha, beta]\n---\n",
			"utf8",
		);
		writeFileSync(join(planning, "alpha", "master.md"), "---\nsubplans: [beta]\n---\n", "utf8");
		const after = parseAllPlans(root);

		// Grouping is a display concern: what the CLI and MCP report must not move.
		expect(after.map((p) => p.name).sort()).toEqual(before.map((p) => p.name).sort());
		expect(after.map((p) => p.stage)).toEqual(before.map((p) => p.stage));
		expect(after.map((p) => p.stageStatus)).toEqual(before.map((p) => p.stageStatus));
	});
});
