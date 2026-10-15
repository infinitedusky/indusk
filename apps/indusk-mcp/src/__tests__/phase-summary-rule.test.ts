import { describe, expect, it } from "vitest";
import { validateWrite } from "./helpers/hook-runner.js";
import { NO_TESTS_FLIP, summaryImpl } from "./helpers/phase-summary-fixture.js";

/**
 * promise: an-impl-phase-explains-itself — A1, A2, A3, A14, A15 of the
 * story-first-phases impl (the phase_summary rule of the save check).
 *
 * An impl that opts in with `phase_summary: required` has each phase open with
 * a paragraph, each task as one plain sentence with no code and no row label,
 * and its technical detail folded beneath. Driven through the real
 * validate-impl-structure hook, as phase-tier-rule.test.ts does. Every case
 * first asserts the well-formed shape passes, so a red here is the refusal
 * missing and not a broken fixture.
 */

describe("the well-formed shape passes the save check (the control for every case below)", () => {
	it("accepts an opted-in impl with a paragraph per phase and plain sentences", async () => {
		const r = await validateWrite(summaryImpl("demo"));
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("A1 — a phase that goes straight from its Tier line to its tasks is refused", () => {
	it("refuses a build phase with no paragraph, naming the phase", async () => {
		const r = await validateWrite(summaryImpl("demo", { buildParagraph: null }));
		expect(r.exitCode, "a Build Phase 1 with no summary paragraph").toBe(2);
		expect(r.stderr).toMatch(/Build Phase 1/);
	});

	it("refuses a test phase with no paragraph, naming the phase", async () => {
		const r = await validateWrite(summaryImpl("demo", { testParagraph: null }));
		expect(r.exitCode, "a Test Phase 1 with no summary paragraph").toBe(2);
		expect(r.stderr).toMatch(/Test Phase 1/);
	});

	it("leaves an impl that has not opted in alone", async () => {
		const r = await validateWrite(summaryImpl("demo", { optIn: false, buildParagraph: null }));
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("A2 — a task line that carries code is refused, naming the task", () => {
	it("refuses a backticked name on the line and says the code belongs in the detail", async () => {
		const r = await validateWrite(
			summaryImpl("demo", {
				buildTask: {
					sentence:
						"The save check refuses a phase with no summary in `validate-impl-structure.js`",
					detail: "A new rule beside the tier rule.",
				},
			}),
		);
		expect(r.exitCode, "a task line carrying a backticked file name").toBe(2);
		expect(r.stderr).toContain("The save check refuses a phase with no summary");
		expect(r.stderr).toMatch(/detail/i);
	});

	it("accepts the same sentence once the code sits in the folded detail", async () => {
		const r = await validateWrite(
			summaryImpl("demo", {
				buildTask: {
					sentence: "The save check refuses a phase with no summary",
					detail: "In `validate-impl-structure.js`, a new rule beside the tier rule.",
				},
			}),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("A3 — the rule holds for every kind of task", () => {
	const cases: Array<[string, string, Parameters<typeof summaryImpl>[1]]> = [
		[
			"a test phase task",
			"Tests that the planner template follows the shape",
			{
				testTask: {
					sentence: "Tests that the planner template follows the shape, run with `vitest`",
					detail: "A4 in the template test.",
				},
			},
		],
		[
			"a Verification task",
			"Everything passes",
			{
				verificationTask: {
					sentence: `Everything passes ${NO_TESTS_FLIP} when you run \`pnpm test\``,
				},
			},
		],
		[
			"a Context task",
			"The planning rules say where",
			{
				contextTask: {
					sentence:
						"The planning rules say where the shape is written, in `templates/planning/CLAUDE.md`",
				},
			},
		],
		[
			"a Document task",
			"The docs guide shows",
			{
				documentTask: {
					sentence: "The docs guide shows the shape; edit `apps/docs/src/guide/test-trajectory.md`",
				},
			},
		],
	];

	it.each(cases)("refuses %s with code on its line", async (kind, named, spec) => {
		const r = await validateWrite(summaryImpl("demo", spec));
		expect(r.exitCode, `${kind} with a backticked name or command on the line`).toBe(2);
		expect(r.stderr).toContain(named);
	});
});

describe("A14 — a row label in a paragraph or a sentence is refused, naming it and where", () => {
	it("refuses a phase paragraph that holds a row label, naming the phase and the label", async () => {
		const r = await validateWrite(
			summaryImpl("demo", {
				buildParagraph: "This phase makes A2 pass, so the plan can be written in the shape.",
			}),
		);
		expect(r.exitCode, "a phase paragraph holding the label A2").toBe(2);
		expect(r.stderr).toMatch(/Build Phase 1/);
		expect(r.stderr).toContain("A2");
	});

	it("refuses a task sentence that holds a row label, naming the task and the label", async () => {
		const r = await validateWrite(
			summaryImpl("demo", {
				buildTask: {
					sentence: "The save check refuses what T3 describes",
					detail: "A new rule beside the tier rule.",
				},
			}),
		);
		expect(r.exitCode, "a task sentence holding the label T3").toBe(2);
		expect(r.stderr).toContain("The save check refuses what");
		expect(r.stderr).toContain("T3");
	});
});

describe("A15 — a Verification task may name the rows it proves in its folded detail", () => {
	it("accepts a Verification sentence with no label whose detail names a trajectory row", async () => {
		const r = await validateWrite(
			summaryImpl("demo", {
				verificationTask: {
					sentence: "The save check refuses the shapes it should",
					detail: "Green: T1. Run the rule's test file.",
				},
			}),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("refuses a row label in the detail that is not in the trajectory, naming it", async () => {
		const r = await validateWrite(
			summaryImpl("demo", {
				verificationTask: {
					sentence: "The save check refuses the shapes it should",
					detail: "Green: T1 and T99.",
				},
			}),
		);
		expect(r.exitCode, "an unknown label folded in a Verification detail").toBe(2);
		expect(r.stderr).toContain("T99");
	});
});
