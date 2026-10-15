/**
 * An impl in the shape `phase_summary: required` introduces (story-first-phases):
 * each phase opens with a paragraph, each task is one plain sentence, and the
 * technical instruction is folded beneath it. Text only; `validateWrite` /
 * `runHook` put it in front of the real hooks.
 *
 * The defaults are well-formed under the rule, and no line of them carries a
 * row label or a backtick, so a test overrides exactly one thing and any
 * refusal that follows is that one thing's.
 */

export interface TaskSpec {
	/** The task line after the box. */
	sentence: string;
	/** The folded detail's body, if any. */
	detail?: string;
	checked?: boolean;
}

export interface SummaryImplSpec {
	/** Extra frontmatter lines, after `phase_summary: required`. */
	keys?: string[];
	/** Frontmatter `phase_summary:` line; `null` leaves the impl opted out. */
	optIn?: boolean;
	/** The paragraph after each phase's Tier line; `null` goes straight to the tasks. */
	buildParagraph?: string | null;
	testParagraph?: string | null;
	testTask?: TaskSpec;
	buildTask?: TaskSpec;
	verificationTask?: TaskSpec;
	testVerificationTask?: TaskSpec;
	contextTask?: TaskSpec;
	documentTask?: TaskSpec;
	/** Trajectory table rows; the default is one row, T1. */
	trajectoryRows?: string[];
}

const PLAIN_PARAGRAPH =
	"This phase writes down what done means for the whole plan, as tests that fail today, so the build phases that follow have something to turn green.";

/** A passing Verification line that names no row label: the declaration is the one thing the cross-reference rule accepts without one. */
export const NO_TESTS_FLIP = "(no tests flip at this phase — reason: refactor)";

function task(spec: TaskSpec): string[] {
	const lines = [`- [${spec.checked ? "x" : " "}] ${spec.sentence}`];
	if (spec.detail !== undefined) {
		lines.push(
			"  <details><summary>Technical</summary>",
			"",
			...spec.detail.split("\n").map((l) => (l === "" ? "" : `  ${l}`)),
			"",
			"  </details>",
		);
	}
	return lines;
}

function paragraph(text: string | null | undefined, fallback: string): string[] {
	if (text === null) return [];
	return ["", text ?? fallback];
}

export function summaryImpl(plan: string, spec: SummaryImplSpec = {}): string {
	const rows = spec.trajectoryRows ?? [
		"| T1 | the thing holds | Test Phase 1 | Build Phase 1 | planned |",
	];
	return [
		"---",
		`title: "${plan}"`,
		"status: draft",
		"trajectory: required",
		"test_phases: required",
		...(spec.optIn === false ? [] : ["phase_summary: required"]),
		...(spec.keys ?? []),
		"---",
		"",
		`# ${plan}`,
		"",
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State |",
		"|----|---------|-------------|-----------|-------|",
		...rows,
		"",
		"## Checklist",
		"",
		"### Test Phase 1: Write every test first",
		"",
		"**Tier**: med — the work step's default",
		...paragraph(spec.testParagraph, PLAIN_PARAGRAPH),
		"",
		...task(
			spec.testTask ?? {
				sentence: "Tests that the save check refuses a phase with no summary, failing for now",
				detail: "`phase-summary-rule.test.ts`, driven through the real hook.",
			},
		),
		"",
		"#### Test Phase 1 Verification",
		"",
		...task(
			spec.testVerificationTask ?? {
				sentence: `Every new test fails on its own assertion ${NO_TESTS_FLIP}`,
			},
		),
		"",
		"### Build Phase 1: The save check holds the shape",
		"",
		"**Tier**: med — the work step's default",
		...paragraph(
			spec.buildParagraph,
			"The script that checks an impl file when it is saved learns the new rule, so a plan can be written in the shape and be held to it.",
		),
		"",
		...task(
			spec.buildTask ?? {
				sentence: "The save check refuses a phase with no summary",
				detail: "`hooks/validate-impl-structure.js`, a new rule beside the tier rule.",
			},
		),
		"",
		"#### Build Phase 1 Verification",
		"",
		...task(
			spec.verificationTask ?? {
				sentence: `The save check refuses the shapes it should ${NO_TESTS_FLIP}`,
			},
		),
		"",
		"#### Build Phase 1 Context",
		"",
		...task(
			spec.contextTask ?? {
				sentence: "The planning rules say where the shape is written",
				detail: "`templates/planning/CLAUDE.md`, The impl.",
			},
		),
		"",
		"#### Build Phase 1 Document",
		"",
		...task(
			spec.documentTask ?? {
				sentence: "The docs guide shows the shape",
				detail: "`apps/docs/src/guide/test-trajectory.md`.",
			},
		),
		"",
	].join("\n");
}
