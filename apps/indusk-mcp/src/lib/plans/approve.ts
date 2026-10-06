import { git } from "../git.js";
import { checkPlanContract } from "../promises/contract.js";
import { statusPaths } from "./bookkeeping.js";
import {
	branchChanges,
	implPath,
	mergeIntoTrunk,
	PlanCommandRefusal,
	planBranch,
	refuseDirtyTrunk,
	setImplKeys,
} from "./plan-branch.js";

/**
 * `indusk plans approve <name>` (admin-plan-authoring, ADR D3): the plan's
 * documents and declared promises reach the trunk in one merge, and its build
 * continues on the same branch. Refused, with nothing written, when the brief
 * check refuses, when the branch already holds anything but plan documents,
 * or when the trunk has uncommitted changes where the merge would land.
 *
 * promise: a-plan-is-written-on-its-own-branch
 */

export interface ApprovedPlan {
	plan: string;
	/** The trunk's merge commit. */
	merge: string;
	/** The paths that reached the trunk. */
	paths: string[];
}

export async function approvePlan(anyCheckout: string, plan: string): Promise<ApprovedPlan> {
	const pb = await planBranch(anyCheckout, plan);
	const impl = implPath(pb);
	await commitPlanDocuments(pb);

	const paths = await branchChanges(pb);
	const outside = paths.filter((p) => !p.startsWith(".indusk/"));
	if (outside.length > 0) {
		throw new PlanCommandRefusal(
			`${plan}'s branch already changes files outside .indusk/, so it is past approval: ${outside.join(", ")}`,
		);
	}

	const contract = checkPlanContract(pb.worktree, plan);
	if (!contract.ok) {
		throw new PlanCommandRefusal(
			[
				`${plan} cannot be approved; its brief check refuses:`,
				...contract.refusals.map((r) => `  ${r.message}`),
			].join("\n"),
		);
	}

	await refuseDirtyTrunk(pb, paths, `before approving ${plan}`);
	await setImplKeys(pb, impl, { status: "approved" }, `plan(${plan}): impl approved`);
	const merge = await mergeIntoTrunk(pb, `plan(${plan}): approved — its documents and promises`);
	return { plan, merge, paths };
}

/**
 * A planning session writes the plan's documents and promises and may leave
 * them uncommitted (found in admin-plan-authoring's live check). Approval is
 * the moment they reach the trunk, so it commits them on the branch — the
 * plan's own `.indusk/` files and nothing else. Uncommitted work outside
 * `.indusk/` is refused, naming it, with nothing committed.
 */
async function commitPlanDocuments(pb: Awaited<ReturnType<typeof planBranch>>): Promise<void> {
	const lines = await statusPaths(pb.worktree);
	const outside = lines.filter((path) => !path.startsWith(".indusk/"));
	if (outside.length > 0) {
		throw new PlanCommandRefusal(
			`${pb.plan}'s worktree ${pb.worktree} has uncommitted changes outside .indusk/ — commit or move them first: ${outside.join(", ")}`,
		);
	}
	if (lines.length === 0) return;
	await git(pb.worktree, "add", "--", ".indusk");
	await git(
		pb.worktree,
		"commit",
		"-q",
		"-m",
		`plan(${pb.plan}): documents and promises, for approval`,
	);
}
