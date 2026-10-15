import { describe, expect, it } from "vitest";
import { phaseSummaryProblems, ROW_LABEL } from "../../hooks/_phase-summary.js";
import { validateWrite } from "./helpers/hook-runner.js";
import { summaryImpl } from "./helpers/phase-summary-fixture.js";

/**
 * promise: an-impl-phase-explains-itself — A19 of the story-first-phases impl.
 *
 * The phase-summary rule lives in its own hook module, `hooks/_phase-summary.js`.
 * Read from there it must name the same problems as the save check does when
 * the same impl is written: a missing paragraph, code on a task line, a row
 * label in a paragraph and a row label in a task. Each case also asserts the
 * well-formed impl has no problems, so a red is the rule and not the fixture.
 */

const REQUIRED = true;

describe("the module reads a well-formed impl as having no problems", () => {
	it("returns nothing for an opted-in impl in the shape", () => {
		expect(phaseSummaryProblems(summaryImpl("demo"), REQUIRED)).toEqual([]);
	});

	it("returns nothing when the impl has not opted in", () => {
		expect(phaseSummaryProblems(summaryImpl("demo", { buildParagraph: null }), false)).toEqual([]);
	});
});

describe("A19 — the module names what the save check names", () => {
	const cases: Array<[string, Parameters<typeof summaryImpl>[1], RegExp]> = [
		["a missing paragraph", { buildParagraph: null }, /Build Phase 1.* has no summary paragraph/],
		[
			"code on a task line",
			{
				buildTask: {
					sentence:
						"The save check refuses a phase with no summary in `validate-impl-structure.js`",
					detail: "A new rule beside the tier rule.",
				},
			},
			/carries code on its line/,
		],
		[
			"a row label in a paragraph",
			{
				buildParagraph: "The script learns the rule that A2 asserts, so a plan can be held to it.",
			},
			/summary paragraph names the row label A2/,
		],
		[
			"a row label in a task",
			{
				buildTask: {
					sentence: "The save check refuses what T3 asserts",
					detail: "A new rule beside the tier rule.",
				},
			},
			/names the row label T3/,
		],
	];

	for (const [name, spec, expected] of cases) {
		it(`reports ${name}, and the save check refuses with the same words`, async () => {
			const body = summaryImpl("demo", spec);
			const problems = phaseSummaryProblems(body, REQUIRED);
			expect(problems.length, `the module on ${name}`).toBeGreaterThan(0);
			expect(problems.join("\n")).toMatch(expected);

			const r = await validateWrite(body);
			expect(r.exitCode, `the save check on ${name}`).toBe(2);
			for (const problem of problems) expect(r.stderr).toContain(problem);
		});
	}
});

describe("the row-label pattern is exported once", () => {
	it("matches trajectory row labels and nothing broader", () => {
		const found = "T3 and A12, not B4 or TA5 or AT1".match(new RegExp(ROW_LABEL.source, "g"));
		expect(found).toEqual(["T3", "A12"]);
	});
});
