import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateWrite } from "./helpers/hook-runner.js";

/**
 * promise: an-impl-phase-explains-itself — A4 and A16 of the
 * story-first-phases impl.
 *
 * Prose has no other test, so this reads the planner skill as text: the impl
 * template it hands out must itself be written in the shape `phase_summary:
 * required` introduces and pass the save check as written (A4), and step 7,
 * the instructions for writing an impl, must tell the planner who it is
 * writing for, with a before-and-after pair (A16).
 */

const PKG = resolve(__dirname, "../..");
const planner = readFileSync(join(PKG, "skills/planner.md"), "utf-8");

/** The text from `start` up to (not including) the next `end` after it. */
function between(text: string, start: RegExp, end: RegExp): string {
	const from = text.search(start);
	expect(from, `no match for ${start}`).toBeGreaterThanOrEqual(0);
	const rest = text.slice(from + 1);
	const to = rest.search(end);
	return to === -1 ? rest : rest.slice(0, to);
}

/**
 * The impl template's body: the fenced block after `### impl.md`. The block
 * contains fences of its own at the same length, so it ends at the last bare
 * fence line before the next `###` document template, not at the first.
 */
function implTemplate(): string {
	const section = between(planner, /^### impl\.md$/m, /^### retrospective\.md$/m);
	const open = section.indexOf("```markdown\n");
	expect(open, "no ```markdown block after ### impl.md").toBeGreaterThanOrEqual(0);
	const close = section.lastIndexOf("\n```");
	return section.slice(open + "```markdown\n".length, close + 1);
}

/**
 * Every `{…}` placeholder, innermost first, replaced by fixed words. Three kinds
 * of placeholder stand for something the validator reads, so they are filled
 * with a value of that kind: a tier, a list of row labels, and a trajectory
 * row's reason (its "For" cell).
 */
function fillPlaceholders(template: string): string {
	let text = template.replace(/^status: .*$/m, "status: draft");
	for (;;) {
		const next = text.replace(/\{([^{}]*)\}/g, (_all, inner: string) => {
			if (/^tier\b/.test(inner)) return "med";
			if (/^T1, T2/.test(inner)) return "T1, T2";
			if (/^a regression guard over/.test(inner))
				return "a regression guard over the existing plans";
			return "words";
		});
		if (next === text) return next;
		text = next;
	}
}

describe("phase-summaries A4 — the impl template the planner hands out is in the new shape", () => {
	it("opts in and passes the save check as written", async () => {
		const filled = fillPlaceholders(implTemplate());
		expect(filled, "the template's frontmatter").toMatch(/^phase_summary:\s*required/m);
		const r = await validateWrite(filled);
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("phase-summaries A16 — the planner's impl instructions ask for writing without shorthand", () => {
	const step7 = () => between(planner, /^7\. \*\*If ADR is accepted\*\*/m, /^8\. /m);

	it("says to write for someone who knows the project but none of its shorthand", () => {
		expect(step7()).toContain("knows none of its shorthand");
	});

	it("gives a before-and-after pair", () => {
		const text = step7();
		expect(text).toMatch(/\bBefore:/i);
		expect(text).toMatch(/\bAfter:/i);
	});
});

/**
 * promise: an-impl-phase-explains-itself — A1 to A3 of the
 * impl-tasks-are-instructions impl.
 *
 * A task reads as work to do and a verification item as what must hold. The
 * planner's instructions are the product, so these read them as text.
 */

/** Placeholder checkbox lines `- [ ] {…}`, each with the `####` gate heading it sits under (or "" for a phase's own tasks). */
function placeholders(text: string): { gate: string; line: string }[] {
	const found: { gate: string; line: string }[] = [];
	let gate = "";
	for (const line of text.split("\n")) {
		if (/^###\s/.test(line)) gate = "";
		else if (/^####\s/.test(line)) gate = line;
		else if (/^- \[ \] \{/.test(line)) found.push({ gate, line });
	}
	return found;
}

describe("impl-tasks-are-instructions A1 — the planner says a task is an instruction", () => {
	const step7 = () => between(planner, /^7\. \*\*If ADR is accepted\*\*/m, /^8\. /m);

	it("says a task is one plain instruction saying what to do, and a verification item what must hold", () => {
		const text = step7();
		expect(text).toContain("one plain instruction");
		expect(text).toContain("what to do");
		expect(text).toContain("what must hold");
	});

	it("gives a before-and-after pair for a task written as an instruction", () => {
		const text = step7();
		expect(text).toContain("Make the prompt box");
		expect(text).toMatch(/\bBefore:[^]*\bAfter:[^]*Make the prompt box/i);
	});

	it("no longer says a task states what will be true when it is done", () => {
		expect(step7()).not.toContain("what will be true when it is done");
	});
});

describe("impl-tasks-are-instructions A2 — the impl template's placeholders ask for instructions", () => {
	it("every task placeholder asks for an instruction", () => {
		const tasks = placeholders(implTemplate()).filter((p) => p.gate === "");
		expect(tasks.length, "no task placeholders found").toBeGreaterThan(0);
		for (const { line } of tasks) expect(line, line).toMatch(/\binstruction\b/i);
	});

	it("every verification placeholder asks for what must hold", () => {
		const items = placeholders(implTemplate()).filter((p) => /Verification\s*$/.test(p.gate));
		expect(items.length, "no verification placeholders found").toBeGreaterThan(0);
		for (const { line } of items) expect(line, line).toMatch(/must hold/i);
	});
});

describe("impl-tasks-are-instructions A6 — the gate tasks ask for instructions too", () => {
	it("every OTel, Context and Document placeholder asks for an instruction", () => {
		const gateTasks = placeholders(implTemplate()).filter((p) => /(OTel|Context|Document)\s*$/.test(p.gate));
		expect(gateTasks.length, "no OTel, Context or Document placeholders found").toBeGreaterThanOrEqual(3);
		for (const { line } of gateTasks) expect(line, line).toMatch(/\binstruction\b/i);
	});
});

describe("impl-tasks-are-instructions A3 — the shipped planning rules say the same", () => {
	const REPO = resolve(PKG, "../..");
	const rules = readFileSync(join(PKG, "templates/planning/CLAUDE.md"), "utf-8");
	const entry = () => between(rules, /^- \*\*A new impl opts in with `phase_summary: required`/m, /^- /m);

	it("says a task is one plain instruction and a verification item what must hold, and the project's copy matches", () => {
		const text = entry();
		expect(text).toMatch(/one plain\s+instruction/);
		expect(text).toMatch(/what\s+must\s+hold/);
		expect(text).not.toMatch(/each task is one plain\s+sentence/);
		expect(readFileSync(join(REPO, ".indusk/planning/CLAUDE.md"), "utf-8")).toBe(rules);
	});
});
