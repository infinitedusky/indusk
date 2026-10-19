import type { Tracer } from "@opentelemetry/api";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";

/**
 * The three clauses of `a-brief-is-accepted-on-current-main`, reported by the code that keeps
 * them (`bringTrunkIntoPlan`, so the command line and the admin's planning start alike). Each
 * verdict is decided from what git says after the code ran, never from what the code meant to
 * do: the trunk is an ancestor of the branch after a merge, no merge is left behind after a
 * conflict, and a refusal's own words never tell the person to merge. Best-effort: a report
 * that cannot be sent never fails the acceptance or the planning start.
 *
 * clause: a-brief-is-accepted-on-current-main/main-is-merged-first
 * clause: a-brief-is-accepted-on-current-main/a-conflict-refuses
 * clause: a-brief-is-accepted-on-current-main/the-person-never-merges
 */

const PROMISE = "a-brief-is-accepted-on-current-main";
const SIGNAL = { plan: PROMISE, phase: "Build Phase 1" };

const verdict = (clause: string, broken?: string): ClauseVerdict => ({
	promise: PROMISE,
	clause,
	...(broken === undefined ? {} : { broken }),
});

/** Whether a refusal's words tell the person to merge (or rebase onto, or pull) the trunk by hand. */
export function asksPersonToMerge(message: string, trunk: string): boolean {
	const words = new RegExp(
		`\\b(?:merge|rebase|pull)\\b[^.\\n]*\\b(?:main|master|trunk|${escapeRegExp(trunk)})\\b`,
		"i",
	);
	return words.test(message);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The trunk came in: it is an ancestor of the branch, and the person was asked nothing. */
export function mergedVerdicts(
	trunk: string,
	branch: string,
	trunkIsAncestor: boolean,
): ClauseVerdict[] {
	return [
		verdict(
			"main-is-merged-first",
			trunkIsAncestor ? undefined : `${trunk} is not part of ${branch} after the merge`,
		),
		verdict("the-person-never-merges"),
	];
}

/** What a conflict left behind in the checkout: nothing when the merge was undone and the branch is as it was. */
export interface Leftover {
	midMerge: boolean;
	unmerged: string[];
	moved: boolean;
}

/** A conflicting acceptance was refused: broken when any of the merge is left in the checkout. */
export function conflictVerdicts(trunk: string, message: string, left: Leftover): ClauseVerdict[] {
	const parts = [
		left.midMerge ? "a merge is still in progress" : "",
		left.unmerged.length > 0 ? `unmerged files: ${left.unmerged.join(", ")}` : "",
		left.moved ? "the branch's head moved" : "",
	].filter(Boolean);
	return [
		verdict(
			"a-conflict-refuses",
			parts.length > 0 ? `a conflict was refused but ${parts.join("; ")}` : undefined,
		),
		neverMerges(trunk, message),
	];
}

/** Any other refusal: the clause that the person is never asked to merge. */
export function refusalVerdicts(trunk: string, message: string): ClauseVerdict[] {
	return [neverMerges(trunk, message)];
}

function neverMerges(trunk: string, message: string): ClauseVerdict {
	return verdict(
		"the-person-never-merges",
		asksPersonToMerge(message, trunk)
			? `a refusal told the person to merge ${trunk}: ${message.split("\n").find((l) => asksPersonToMerge(l, trunk)) ?? message}`
			: undefined,
	);
}

/** Write the verdicts through the commands' one tracer, or the one handed in; never throws. */
export async function reportBring(
	root: string,
	plan: string,
	verdicts: readonly ClauseVerdict[],
	tracer?: Tracer,
): Promise<void> {
	await writeClauseSignals(root, "plan.accept-brief", plan, SIGNAL, verdicts, tracer);
}
