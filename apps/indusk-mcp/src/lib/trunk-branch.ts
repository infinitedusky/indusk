import { getTrunkBranches } from "./config.js";
import { git } from "./git.js";

/**
 * Which branch the trunk is checked out on, and whether it is one of the
 * project's trunk branches (admin-plan-authoring A38). Starting a plan's
 * worktree, approving and landing a plan refuse when it is not, each in its
 * own words; the review diffs against it. One reader, so the four cannot
 * disagree about what the trunk is.
 *
 * promise: one-definition-per-shared-rule
 */

export interface TrunkBranch {
	/** The checked-out branch; empty when the trunk is detached. */
	branch: string;
	/** The project's trunk branches (`worktree.trunk_guard.branches`, else main and master). */
	allowed: string[];
	onTrunk: boolean;
}

export async function currentTrunkBranch(projectRoot: string): Promise<TrunkBranch> {
	const branch = await git(projectRoot, "branch", "--show-current");
	const allowed = getTrunkBranches(projectRoot);
	return { branch, allowed, onTrunk: allowed.includes(branch) };
}
