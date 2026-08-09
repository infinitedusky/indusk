import { parseImplString } from "../impl-parser.js";
import { changedFilesForPhase } from "./changed.js";
import { appendItemToPhase } from "./findings.js";
import { type CraftRuleSet, collectCraftRules } from "./rules.js";

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
 */

export type ShapeOutcome =
	| { kind: "review"; files: string[]; rules: CraftRuleSet }
	| { kind: "skipped"; reason: string };

/**
 * Is this phase's Verification gate fully checked?
 *
 * A phase with no Verification gate at all counts as not-green. That is the safe
 * direction: the question Shape needs answered is "has correctness been proven",
 * and an absent gate proves nothing. Reading absence as permission is how a
 * check ends up passing for the wrong reason.
 */
function verificationIsGreen(implBody: string, phase: number): boolean {
	const parsed = parseImplString(implBody);
	const target = parsed.phases.find((p) => p.number === phase);
	if (!target) {
		throw new Error(
			`Cannot prepare a Shape review for Phase ${phase} — this impl has no such phase.`,
		);
	}

	const verification = target.gates.find((gate) => gate.type === "verification");
	if (!verification || verification.items.length === 0) return false;
	return verification.items.every((item) => item.checked);
}

/**
 * Gather what a Shape review needs, or the reason there is nothing to review.
 *
 * Order matters. Verification is checked first because restructuring code whose
 * correctness is unproven is how a refactor hides a bug — the same ordering
 * `/cleanup` already obeys — and because a phase with failing tests has a more
 * urgent problem than shape.
 */
export async function prepareShapeReview(options: {
	root: string;
	plan: string;
	phase: number;
	implBody: string;
}): Promise<ShapeOutcome> {
	if (!verificationIsGreen(options.implBody, options.phase)) {
		return {
			kind: "skipped",
			reason: `Phase ${options.phase}'s verification is not green. Shape does not review code whose correctness is unproven — finish the Verification gate first.`,
		};
	}

	const files = await changedFilesForPhase({
		root: options.root,
		plan: options.plan,
		phase: options.phase,
	});

	if (files.length === 0) {
		return {
			kind: "skipped",
			reason: `Phase ${options.phase} changed no code files — no code surface to review. (InDusk machine state and plan documents are excluded by design, so a docs-only or planning-only phase lands here.)`,
		};
	}

	return { kind: "review", files, rules: await collectCraftRules(options.root) };
}

/**
 * Record that the review ran and found nothing.
 *
 * Checked, not unchecked: "nothing to do" must be a cheap and common answer, or
 * Shape becomes a nag and a nag gets ticked through without reading. What it
 * must never be is *absent* — silence cannot be told apart from never having
 * run, which is the failure this whole outcome vocabulary exists to prevent.
 */
export function recordReviewedNothingFound(implBody: string, phase: number): string {
	return appendItemToPhase(
		implBody,
		phase,
		"- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.",
	);
}

/**
 * Record a file that was looked at and deliberately left alone.
 *
 * Distinct from a file never reviewed, and the reason is the whole point: it is
 * what makes the decision reviewable later. "No finding" and "considered, and
 * here is why it stays" are different claims.
 */
export function recordLeftAsIs(
	implBody: string,
	phase: number,
	file: string,
	reason: string,
): string {
	return appendItemToPhase(
		implBody,
		phase,
		`- [x] Shape (\`${file}\`) — reviewed, left as-is: ${reason}`,
	);
}
