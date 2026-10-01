import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * admin-plan-type — A12, A13, A14, A17.
 *
 * What a plan type requires was stated in two places before this plan — the
 * planner skill's Workflow Types table and the four files under
 * `templates/workflows/` — and they already disagreed: the table says a bugfix
 * is brief + test plan + impl, and the bugfix template lists only a brief and
 * an impl. A bugfix written from the template closed without a test plan.
 *
 * The admin needs the same facts to explain a type, which makes a third
 * statement. This pins all three equal, so the next one to change is a named
 * failure rather than a drift.
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;
const PKG = join(REPO_ROOT, "apps/indusk-mcp");
const SKILL = join(PKG, "skills/planner.md");
const INSTALLED_SKILL = join(REPO_ROOT, ".claude/skills/planner/SKILL.md");
const TEMPLATES = join(PKG, "templates/workflows");

const TYPES = ["feature", "bugfix", "refactor", "spike"] as const;
/** The documents `/planner` and `/work` write. The retrospective is `/retrospective`'s. */
const PLANNING_DOCS = ["research", "brief", "test-plan", "adr", "impl"] as const;

interface Definition {
	purpose: string;
	requires: readonly string[];
	skips: readonly string[];
	why: string;
}

/**
 * Loaded inside the test, by a computed specifier: the module does not exist
 * until Build Phase 1, and a static import of a missing file fails the whole
 * file to load — an absent test wearing a failure's clothes.
 */
async function loadDefinitions(): Promise<Record<string, Definition> | null> {
	const specifier = ["..", "lib", "workflow-types.js"].join("/");
	try {
		const mod = (await import(/* @vite-ignore */ specifier)) as {
			WORKFLOW_DEFINITIONS?: Record<string, Definition>;
		};
		return mod.WORKFLOW_DEFINITIONS ?? null;
	} catch {
		return null;
	}
}

/** The planning documents a line of prose names, in lifecycle order. */
function docsNamed(text: string): string[] {
	const lower = text.toLowerCase();
	return PLANNING_DOCS.filter((doc) =>
		doc === "impl" ? /\bimpl\b/.test(lower) : lower.includes(doc),
	);
}

/** `type → documents`, read from the skill's Workflow Types table. */
function skillTable(): Record<string, string[]> {
	const skill = readFileSync(SKILL, "utf-8");
	const section = skill.slice(skill.indexOf("## Workflow Types"));
	const out: Record<string, string[]> = {};
	for (const line of section.split("\n")) {
		const cells = line.split("|").map((c) => c.trim());
		// | `/planner bugfix auth-expiry` | bugfix | brief + test-plan + impl |
		if (cells.length < 5 || !cells[1].startsWith("`/planner ")) continue;
		const type = cells[2];
		if (!(TYPES as readonly string[]).includes(type)) continue;
		// The last row repeats `feature` as "same — no type defaults to feature".
		if (out[type] !== undefined) continue;
		out[type] = cells[3].includes("research only") ? ["research"] : docsNamed(cells[3]);
	}
	return out;
}

/** The documents a workflow template's "Documents Created" list names. */
function templateDocs(type: string): string[] {
	const text = readFileSync(join(TEMPLATES, `${type}.md`), "utf-8");
	const start = text.indexOf("## Documents Created");
	const rest = text.slice(start + "## Documents Created".length);
	const end = rest.search(/\n## /);
	const list = end === -1 ? rest : rest.slice(0, end);
	const named = list
		.split("\n")
		.filter((l) => l.trim().startsWith("- "))
		.map((l) => /`([a-z-]+)\.md`/.exec(l)?.[1])
		.filter((d): d is string => d !== undefined);
	return PLANNING_DOCS.filter((doc) => named.includes(doc));
}

const REFERENCE_PAGE = join(REPO_ROOT, "apps/docs/src/reference/skills/plan.md");
const ALL_DOCS = [...PLANNING_DOCS, "retrospective"] as const;

/**
 * `type → documents`, read from the planner reference page's Workflow Types
 * table. This page lists the retrospective, so it is compared in full.
 *
 * Found while documenting this plan: the page was a fourth statement of the
 * same facts, and it said a bugfix was "brief, impl" too.
 */
function referencePageTable(): Record<string, string[]> {
	const page = readFileSync(REFERENCE_PAGE, "utf-8");
	const section = page.slice(page.indexOf("## Workflow Types"));
	const out: Record<string, string[]> = {};
	for (const line of section.split("\n")) {
		const cells = line.split("|").map((c) => c.trim());
		// | **bugfix** | brief, test-plan, impl, retrospective | Known problem … |
		const type = /^\*\*([a-z]+)\*\*$/.exec(cells[1] ?? "")?.[1];
		if (type === undefined || !(TYPES as readonly string[]).includes(type)) continue;
		if (out[type] !== undefined) continue;
		const lower = cells[2].toLowerCase();
		out[type] = lower.includes("research only")
			? ["research"]
			: ALL_DOCS.filter((doc) => (doc === "impl" ? /\bimpl\b/.test(lower) : lower.includes(doc)));
	}
	return out;
}

/** The first fenced markdown template in a document, or null. */
function firstTemplateBlock(text: string): string | null {
	const match = /```markdown\n([\s\S]*?)\n```/.exec(text);
	return match ? match[1] : null;
}

const frontmatterOf = (block: string): string => /^---\n([\s\S]*?)\n---/.exec(block)?.[1] ?? "";

describe("A12 — the admin's facts, the planner's table and the templates agree", () => {
	it("the workflow-types module exists and defines all four types", async () => {
		const definitions = await loadDefinitions();
		expect(definitions, "lib/workflow-types.ts exports no WORKFLOW_DEFINITIONS").not.toBeNull();
		expect(Object.keys(definitions ?? {}).sort()).toEqual([...TYPES].sort());
	});

	it("every type's required planning documents equal the planner skill's table", async () => {
		const definitions = (await loadDefinitions()) ?? {};
		const table = skillTable();
		expect(Object.keys(table).sort(), "the skill table does not list all four types").toEqual(
			[...TYPES].sort(),
		);
		const disagreements = TYPES.filter((type) => {
			const required = PLANNING_DOCS.filter((d) => definitions[type]?.requires.includes(d));
			return JSON.stringify(required) !== JSON.stringify(table[type]);
		});
		expect(
			disagreements,
			`module and skill table disagree on: ${disagreements.join(", ")}`,
		).toEqual([]);
	});

	it("every workflow template's Documents Created list equals the same facts", async () => {
		const definitions = (await loadDefinitions()) ?? {};
		const disagreements = TYPES.filter((type) => {
			const required = PLANNING_DOCS.filter((d) => definitions[type]?.requires.includes(d));
			return JSON.stringify(required) !== JSON.stringify(templateDocs(type));
		}).map((type) => `${type} (template lists: ${templateDocs(type).join(", ")})`);
		expect(disagreements, `module and template disagree on: ${disagreements.join("; ")}`).toEqual(
			[],
		);
	});

	it("the planner reference page's table equals the same facts, retrospective included", async () => {
		const definitions = (await loadDefinitions()) ?? {};
		const table = referencePageTable();
		expect(Object.keys(table).sort(), "the reference page does not list all four types").toEqual(
			[...TYPES].sort(),
		);
		const disagreements = TYPES.filter((type) => {
			const required = ALL_DOCS.filter((d) => definitions[type]?.requires.includes(d));
			return JSON.stringify(required) !== JSON.stringify(table[type]);
		}).map((type) => `${type} (page lists: ${table[type]?.join(", ")})`);
		expect(
			disagreements,
			`module and reference page disagree on: ${disagreements.join("; ")}`,
		).toEqual([]);
	});

	it("each type's requires and skips partition the document positions, with a purpose and a why", async () => {
		const definitions = (await loadDefinitions()) ?? {};
		const all = [...PLANNING_DOCS, "retrospective"].sort();
		const problems = TYPES.filter((type) => {
			const d = definitions[type];
			if (!d?.purpose?.trim() || !d.why?.trim()) return true;
			const union = [...d.requires, ...d.skips].sort();
			return JSON.stringify(union) !== JSON.stringify(all);
		});
		expect(problems, `incomplete definitions: ${problems.join(", ")}`).toEqual([]);
	});
});

describe("A13 — the bugfix template lists the test plan", () => {
	it("Documents Created names test-plan.md", () => {
		expect(templateDocs("bugfix")).toContain("test-plan");
	});
});

describe("A14 — every brief template the planner copies from declares the type", () => {
	it("the skill's brief template carries a workflow line", () => {
		const skill = readFileSync(SKILL, "utf-8");
		const section = skill.slice(skill.indexOf("### brief.md"));
		const block = firstTemplateBlock(section);
		expect(block, "no brief template block in the planner skill").not.toBeNull();
		expect(frontmatterOf(block ?? "")).toMatch(/^workflow:/m);
	});

	it("each workflow template's own brief or research template carries a workflow line naming its type", () => {
		const missing: string[] = [];
		for (const type of TYPES) {
			const block = firstTemplateBlock(readFileSync(join(TEMPLATES, `${type}.md`), "utf-8"));
			// The feature template has no block of its own: it points at the skill's.
			if (block === null) continue;
			if (!new RegExp(`^workflow: ${type}$`, "m").test(frontmatterOf(block))) missing.push(type);
		}
		expect(missing, `templates without \`workflow: <type>\`: ${missing.join(", ")}`).toEqual([]);
	});
});

describe("A17 — the planner skill's installed copy is the package's", () => {
	it("byte-identical", () => {
		expect(readFileSync(INSTALLED_SKILL, "utf-8")).toBe(readFileSync(SKILL, "utf-8"));
	});
});
