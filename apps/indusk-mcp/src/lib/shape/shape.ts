import type { CraftRuleSet } from "./rules.js";

/**
 * The surface `/work`'s Shape step calls.
 *
 * The library supplies facts — which files this phase changed, which rules
 * apply — and the executing agent performs the judgment. In this lane the
 * executor is already a model, so the review costs no extra call; that is the
 * observation the whole design turns on.
 *
 * Three outcomes, never silence: reviewed-with-findings, reviewed-nothing-found,
 * and skipped-with-reason. A check that cannot distinguish "nothing to do" from
 * "did not run" reports the shape of success without doing the work.
 *
 * Phase 3 fills this in.
 */

export type ShapeOutcome =
	| { kind: "review"; files: string[]; rules: CraftRuleSet }
	| { kind: "skipped"; reason: string };

export async function prepareShapeReview(_options: {
	root: string;
	plan: string;
	phase: number;
	implBody: string;
}): Promise<ShapeOutcome> {
	throw new Error("prepareShapeReview is implemented in Phase 3");
}

export function recordReviewedNothingFound(_implBody: string, _phase: number): string {
	throw new Error("recordReviewedNothingFound is implemented in Phase 3");
}

export function recordLeftAsIs(
	_implBody: string,
	_phase: number,
	_file: string,
	_reason: string,
): string {
	throw new Error("recordLeftAsIs is implemented in Phase 3");
}
