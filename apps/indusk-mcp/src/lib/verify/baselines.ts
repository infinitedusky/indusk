import { resolveBootstrapBaseline, resolveCodeBootstrapBaseline } from "./git.js";
import type { VerifyRecord } from "./ledger.js";

/**
 * The two baselines a verification is measured against.
 *
 * A phase boundary is a commit, and in a split project there are two
 * repositories, so there are two of them:
 *
 *   - the PLAN repo's baseline answers "what did the impl say then" — goalpost
 *     drift and the checkoff diff are questions about the plan's own history;
 *   - the CODE repo's baseline answers "what else changed" — red tests and
 *     phantom work are questions about the code.
 *
 * In a flat project they are one commit. Across a split the code baseline is
 * the ledger record's `codeSha`, and **no `codeSha`, no code baseline**: a
 * record written before the split existed carries a sha from the plan repo
 * that names nothing in the code repo's history, so using it would be a
 * confident diff against the wrong yardstick. The code repo bootstraps
 * instead — from its root commit when the merge base is HEAD, so the whole
 * history is the diff and the detectors over-report rather than under-report
 * (dawn-workbench-execution A4).
 *
 * Extracted from `runVerify` at cleanup; the Build Phase 2 Shape note
 * deferred exactly this so the rule would have one home with its docblock.
 */

export interface VerifyBaseline {
	sha: string;
	/** `ledger` = a previous verification recorded it; `merge-base` = bootstrap. */
	source: "ledger" | "merge-base";
}

export interface ResolveBaselinesOptions {
	/** The plan repository. */
	root: string;
	/** The code repository — `root` in a flat project. */
	codeRoot: string;
	split: boolean;
	/** The ledger record chaining into this phase, if a previous verification wrote one. */
	record: VerifyRecord | null | undefined;
	/** The plan's folder, repo-relative, for the bootstrap "where this plan began" floor. */
	planDirRepoRelPath: string;
}

export interface VerifyBaselines {
	planBaseline: VerifyBaseline;
	/** The code baseline — identical to `planBaseline` when not split. */
	baseline: VerifyBaseline;
}

export async function resolveBaselines(options: ResolveBaselinesOptions): Promise<VerifyBaselines> {
	const { root, codeRoot, split, record, planDirRepoRelPath } = options;
	const planBaseline: VerifyBaseline = record
		? { sha: record.sha, source: "ledger" }
		: { sha: await resolveBootstrapBaseline(root, planDirRepoRelPath), source: "merge-base" };
	if (!split) return { planBaseline, baseline: planBaseline };
	const baseline: VerifyBaseline = record?.codeSha
		? { sha: record.codeSha, source: "ledger" }
		: { sha: await resolveCodeBootstrapBaseline(codeRoot), source: "merge-base" };
	return { planBaseline, baseline };
}
