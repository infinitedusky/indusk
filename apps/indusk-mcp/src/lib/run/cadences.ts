import { headShaOrNull } from "../git.js";
import {
	type CommitCadence,
	type CommitFailure,
	type CommitRecord,
	createCommitCadence,
} from "./commit-cadence.js";
import { resolveInRoots, type ToolRoots } from "./worktree-paths.js";

/**
 * The run's commit cadences, built once per run and wired into the gate.
 *
 * Loop-owned commits (dawn-hook-parity A2/A5): a commit fires when a gated
 * edit checks off an impl item; the loop, not the model, owns the git
 * bookkeeping. Every successful CODE commit is handed to `onCodeCommit` — the
 * thin lane's half of the eval rail (A3), which a later drain evaluates from
 * any claude-capable environment (A9).
 *
 * Across a split there are two cadences, one per repository, each staging
 * only its own tree: the code cadence commits the item's code, then the plan
 * cadence commits the checkoff naming the code HEAD it attests in a
 * `Code-Commit:` trailer (dawn-workbench-execution A8). The checkoff commit
 * is not queued — a diff of checkboxes is not work to score. A code repo with
 * no HEAD yet (unborn branch) attests nothing, and the trailer is simply
 * absent rather than an exception through the tool call (A17).
 *
 * Extracted from `runLoop` at cleanup: the loop orchestrates phases and
 * should not also construct cadences.
 */

export interface RunCadencesOptions {
	/** The code repository — where edits, bash and code commits land. */
	root: string;
	/** The plan repository — `root` in a flat project. */
	planRoot: string;
	/** Whether `planRoot` and `root` are different repositories. */
	split: boolean;
	roots: ToolRoots;
	implPath: string;
	planName: string;
	getPhase: () => number;
	/** Fired after each CODE commit lands; the loop feeds the pending-eval queue here. */
	onCodeCommit: (record: CommitRecord) => Promise<void>;
}

export interface RunCadences {
	/** Wire into `RunGateOptions.onGatedApply` — runs every cadence in order. */
	onGatedApply: CommitCadence["onGatedApply"];
	commits: () => CommitRecord[];
	failures: () => CommitFailure[];
	queueFailures: () => CommitFailure[];
	/** One entry per cadence that is off (non-git root) — surface each loudly. */
	disabledReasons: string[];
}

export async function createRunCadences(options: RunCadencesOptions): Promise<RunCadences> {
	const { root, planRoot, split, roots, implPath, planName, getPhase } = options;
	const resolveEditPath = (p: string) => resolveInRoots(roots, p);

	const codeCadence = await createCommitCadence({
		worktreeRoot: root,
		implPath,
		planName,
		getPhase,
		resolveEditPath,
		onCommit: options.onCodeCommit,
	});
	const planCadence = split
		? await createCommitCadence({
				worktreeRoot: planRoot,
				implPath,
				planName,
				getPhase,
				resolveEditPath,
				pathspec: [roots.planDir],
				trailer: async () => {
					const head = await headShaOrNull(root);
					return head ? `Code-Commit: ${head}` : null;
				},
			})
		: null;
	const cadences = planCadence ? [codeCadence, planCadence] : [codeCadence];

	return {
		onGatedApply: async (name, input) => {
			for (const cadence of cadences) await cadence.onGatedApply(name, input);
		},
		commits: () => cadences.flatMap((c) => c.commits),
		failures: () => cadences.flatMap((c) => c.failures),
		queueFailures: () => cadences.flatMap((c) => c.queueFailures),
		disabledReasons: cadences.flatMap((c) => (c.disabledReason ? [c.disabledReason] : [])),
	};
}
