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

/**
 * Which branch is the trunk when the question is what landed, not where the checkout is: the
 * checked-out branch when it is one of the trunk branches, else the first trunk branch that
 * exists, else null. A root checkout on another branch (or detached) still has a trunk, and
 * what landed is read from it, never from whatever the checkout is on (a-run-can-be-trusted
 * A94). Pure: the caller reads the branch and whether each exists.
 */
export function pickTrunk(
	current: string,
	allowed: readonly string[],
	exists: (branch: string) => boolean,
): string | null {
	if (current !== "" && allowed.includes(current)) return current;
	return allowed.find((b) => exists(b)) ?? null;
}
