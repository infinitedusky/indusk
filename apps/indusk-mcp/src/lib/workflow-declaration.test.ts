import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parsePlan } from "./plan-parser.js";

/**
 * admin-plan-type — A19, A23 (falsification).
 *
 * The plan made a plan's declared type the judge of an absent document. Two
 * things about the declaration itself were left loose:
 *
 * - A19: the value was read as `String()` of whatever YAML produced. A list
 *   holding `bugfix` coerces to the text `bugfix` and was accepted as the
 *   type; `workflow: no` parses to a boolean and was shown as `false`, which
 *   nobody wrote.
 * - A23: the plan list's next step named the next document in lifecycle order,
 *   whatever the type — a bugfix with an accepted test plan was told to create
 *   the ADR its own type skips.
 *
 * Every case is a plan folder on disk, read through `parsePlan`: the
 * declarations are real frontmatter, not values handed to a function.
 */

let planning: string;

beforeEach(() => {
	planning = mkdtempSync(join(tmpdir(), "workflow-declaration-"));
});

afterEach(() => {
	rmSync(planning, { recursive: true, force: true });
});

/** Write a plan folder; each document is `[frontmatter lines, status]`. */
function planWith(name: string, documents: Record<string, string[]>): string {
	const dir = join(planning, name);
	mkdirSync(dir, { recursive: true });
	for (const [file, frontmatter] of Object.entries(documents)) {
		writeFileSync(
			join(dir, file),
			["---", `title: "${name}"`, ...frontmatter, "---", "", `# ${name}`, ""].join("\n"),
		);
	}
	return dir;
}

describe("A19 — only a plain word is a type, and anything else is shown as written", () => {
	it("a flow list holding bugfix is not a bugfix", () => {
		const s = parsePlan(
			planWith("listed", { "brief.md": ["status: accepted", "workflow: [bugfix]"] }),
		);
		expect(s.workflow).toBeUndefined();
		expect(s.workflowDeclared).toBe("[bugfix]");
	});

	it("a block list holding bugfix is not a bugfix, and something is reported as declared", () => {
		const s = parsePlan(
			planWith("block-listed", { "brief.md": ["status: accepted", "workflow:", "  - bugfix"] }),
		);
		expect(s.workflow).toBeUndefined();
		expect(s.workflowDeclared, "a declaration was made and must not read as none").toBeTruthy();
		expect(s.workflowDeclared).not.toBe("bugfix");
	});

	it("`workflow: no` is shown as `no`, not as the boolean YAML made of it", () => {
		const s = parsePlan(planWith("negated", { "brief.md": ["status: accepted", "workflow: no"] }));
		expect(s.workflow).toBeUndefined();
		expect(s.workflowDeclared).toBe("no");
	});

	it("a mapping is shown as written, never as [object Object]", () => {
		const s = parsePlan(
			planWith("mapped", { "brief.md": ["status: accepted", "workflow: { kind: bugfix }"] }),
		);
		expect(s.workflow).toBeUndefined();
		expect(s.workflowDeclared).toBe("{ kind: bugfix }");
	});

	it("a number is an unrecognised declaration", () => {
		const s = parsePlan(planWith("numbered", { "brief.md": ["status: accepted", "workflow: 42"] }));
		expect(s.workflow).toBeUndefined();
		expect(s.workflowDeclared).toBe("42");
	});

	it("a plain word, quoted or with a trailing comment, is still its type", () => {
		const quoted = parsePlan(
			planWith("quoted", { "brief.md": ["status: accepted", 'workflow: "bugfix"'] }),
		);
		const commented = parsePlan(
			planWith("commented", {
				"brief.md": ["status: accepted", "workflow: refactor # no behaviour change"],
			}),
		);
		expect(quoted.workflow).toBe("bugfix");
		expect(commented.workflow).toBe("refactor");
		expect(quoted.workflowDeclared).toBeUndefined();
	});

	it("an empty value is nothing declared", () => {
		const s = parsePlan(planWith("empty", { "brief.md": ["status: accepted", "workflow:"] }));
		expect(s.workflow).toBeUndefined();
		expect(s.workflowDeclared).toBeUndefined();
	});
});

describe("A23 — the next step is the next document the plan's type requires", () => {
	it("a bugfix with an accepted test plan is told to create the impl, never the ADR", () => {
		const s = parsePlan(
			planWith("a-bugfix", {
				"brief.md": ["status: accepted", "workflow: bugfix"],
				"test-plan.md": ["status: accepted"],
			}),
		);
		expect(s.nextStep).toBe("Create impl");
	});

	it("a bugfix with an accepted brief is told to create the test plan", () => {
		const s = parsePlan(
			planWith("b-bugfix", { "brief.md": ["status: accepted", "workflow: bugfix"] }),
		);
		expect(s.nextStep).toBe("Create test-plan");
	});

	it("a spike with finished research is not told to create a brief", () => {
		const s = parsePlan(
			planWith("a-spike", { "research.md": ["status: completed", "workflow: spike"] }),
		);
		expect(s.nextStep).not.toMatch(/brief/i);
		expect(s.nextStep).not.toMatch(/^Create /);
	});

	it("a feature with an accepted test plan is told to create the ADR", () => {
		const s = parsePlan(
			planWith("a-feature", {
				"research.md": ["status: completed"],
				"brief.md": ["status: accepted", "workflow: feature"],
				"test-plan.md": ["status: accepted"],
			}),
		);
		expect(s.nextStep).toBe("Create adr");
	});

	it("a plan with no declared type reads as it does today", () => {
		const s = parsePlan(
			planWith("untyped", {
				"brief.md": ["status: accepted"],
				"test-plan.md": ["status: accepted"],
			}),
		);
		expect(s.nextStep).toBe("Create adr");
	});
});
