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
