import { getTrunkBranches } from "../config.js";
import { initEvalOtel } from "../eval/otel.js";
import { git } from "../git.js";
import { markProjectId } from "./config.js";
import { markPromise } from "./mark.js";

/**
 * Whether plans are written on their own branch (admin-plan-authoring, ADR
 * D8). A convention, not a refusal: each commit Claude Code makes is read once
 * it lands, and a commit on the trunk that changes an active plan's documents
 * is marked — violated when it is not a merge, upheld when it is the merge
 * that brought them in. The marks go wherever the evaluator's go.
 *
 * promise: a-plan-is-written-on-its-own-branch
 */

export const OWN_BRANCH_PROMISE = "a-plan-is-written-on-its-own-branch";

export interface TrunkCommitMark {
	plan: string;
	outcome: "upheld" | "violated";
	symptom?: string;
}

/** The marks commit `sha` in `repo` earns; none when it did not land on a trunk branch or touched no active plan. */
export async function trunkCommitMarks(
	repo: string,
	sha: string,
	trunkBranches: string[],
): Promise<TrunkCommitMark[]> {
	const branch = await git(repo, "branch", "--show-current").catch(() => "");
	if (!trunkBranches.includes(branch)) return [];
	const parents = (await git(repo, "rev-list", "--parents", "-n", "1", sha)).split(" ").slice(1);
	const merge = parents.length > 1;
	const changed = merge
		? await git(repo, "diff", "--name-only", `${sha}^1`, sha)
		: await git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha);
	const plans = [
		...new Set(
			changed
				.split("\n")
				.map(activePlanOf)
				.filter((p): p is string => p !== null),
		),
	].sort();
	if (merge) return plans.map((plan) => ({ plan, outcome: "upheld" as const }));
	const subject = await git(repo, "log", "-1", "--format=%s", sha).catch(() => "");
	return plans.map((plan) => ({
		plan,
		outcome: "violated" as const,
		symptom: `${plan} was written on ${branch} in ${sha.slice(0, 8)} ("${subject}"), not on its own branch — indusk plans start <type> ${plan} writes a plan where it belongs`,
	}));
}

/** The plan a path belongs to, when it is inside an active plan's folder. */
function activePlanOf(path: string): string | null {
	const m = path.match(/^\.indusk\/planning\/([^/]+)\/.+/);
	if (!m || m[1] === "archive") return null;
	return m[1];
}

/**
 * Read `sha` in `repo` and mark each plan it touched, one span per mark, on
 * the evaluator's tracer (`eval-trigger.js` calls this in the evaluator's
 * process, whose shutdown flushes them). Never throws: a commit is never held
 * up, or its evaluation lost, over this.
 */
export async function markTrunkCommit(opts: {
	projectRoot: string;
	gitRoot: string;
	sha: string;
}): Promise<number> {
	try {
		const marks = await trunkCommitMarks(
			opts.gitRoot,
			opts.sha,
			getTrunkBranches(opts.projectRoot),
		);
		if (marks.length === 0) return 0;
		const tracer = initEvalOtel(opts.projectRoot);
		for (const m of marks) {
			const span = tracer.startSpan("indusk.plan.own-branch");
			span.setAttribute("indusk.plan", m.plan);
			span.setAttribute("vcs.commit.sha", opts.sha);
			markPromise(span, {
				promise: OWN_BRANCH_PROMISE,
				outcome: m.outcome,
				project: markProjectId(opts.projectRoot),
				...(m.symptom ? { symptom: m.symptom } : {}),
			});
			span.end();
		}
		return marks.length;
	} catch {
		return 0;
	}
}
