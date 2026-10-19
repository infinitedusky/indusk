import { phaseLabel } from "../impl-headings.js";
import type { TestSet, TestSetScope } from "../plans/test-set.js";
import { appendTiming, timingLogPath } from "./log.js";
import { recordSafely } from "./safe.js";

export interface TestRunInput {
	plan: string;
	scope: TestSetScope;
	set: TestSet;
	/** When the run began, ISO. */
	startedAt: string;
	durationMs: number;
	passed: boolean;
	now?: () => number;
	/** The project's machine-state home; the real one when absent. */
	home?: string;
	warn?: (message: string) => void;
}

/** How many files the set holds for each reason it names. */
function countByReason(set: TestSet): { own: number; reached: number; mustNotBreak: number } {
	const counts = { own: 0, reached: 0, mustNotBreak: 0 };
	for (const file of set.files) {
		if (file.reason.startsWith("row ")) counts.own++;
		else if (file.reason.startsWith("must not break:")) counts.mustNotBreak++;
		else counts.reached++;
	}
	return counts;
}

/**
 * Record one finished run of a plan's tests: the plan, the phase or the
 * landing, how many files ran for each reason, how long it took and whether it
 * passed. It only reads the set, so it cannot change which files run, and a
 * record that cannot be written only warns (plan-timing ADR, test-runs-are-recorded).
 *
 * promise: a-plan-says-how-long-it-took
 */
export function recordTestRun(root: string, input: TestRunInput): Promise<void> {
	return recordSafely(
		() =>
			appendTiming(
				timingLogPath(root, input.plan, input.home),
				{
					kind: "test-run",
					plan: input.plan,
					scope: "phase" in input.scope ? { phase: phaseLabel(input.scope.phase) } : "landing",
					files: countByReason(input.set),
					startedAt: input.startedAt,
					durationMs: input.durationMs,
					passed: input.passed,
				},
				input.now,
			),
		input.warn,
	);
}
