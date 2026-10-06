import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readConfig } from "../config.js";
import { git } from "../git.js";
import { releasePlan } from "../worktree/plan-worktree-commands.js";
import {
	branchChanges,
	implKey,
	implPath,
	mergeIntoTrunk,
	PlanCommandRefusal,
	planBranch,
	refuseDirtyTrunk,
	refuseDirtyWorktree,
} from "./plan-branch.js";

const execFileAsync = promisify(execFile);

/**
 * `indusk plans land <name>` (admin-plan-authoring, ADR D3): the one way a
 * plan's build reaches the trunk, and it refuses a plan that has not been
 * accepted. Then what the retrospective's landing step described in prose:
 * bring the trunk into the branch, run the project's checks there, merge
 * into the trunk, release and remove the worktree, delete the branch.
 *
 * The checks are `plans.land_checks` in `.indusk/config.json`, each a shell
 * command run in the worktree; none are run when none are configured.
 */

export interface LandedPlan {
	plan: string;
	merge: string;
	checks: string[];
}

export async function landPlan(anyCheckout: string, plan: string): Promise<LandedPlan> {
	const pb = await planBranch(anyCheckout, plan);
	const impl = implPath(pb);
	if (!implKey(impl, "accepted")) {
		throw new PlanCommandRefusal(
			`${plan} has not been accepted, so it does not land — accept it first (indusk plans accept ${plan})`,
		);
	}
	await refuseDirtyWorktree(pb);

	try {
		await git(pb.worktree, "merge", "--no-edit", pb.trunkBranch);
	} catch (err) {
		await git(pb.worktree, "merge", "--abort").catch(() => undefined);
		throw new PlanCommandRefusal(
			`bringing ${pb.trunkBranch} into ${pb.branch} conflicts; resolve it in ${pb.worktree} and land again: ${(err as Error).message.trim()}`,
		);
	}

	const checks = landChecks(pb.trunk);
	for (const check of checks) {
		try {
			await execFileAsync("sh", ["-c", check], { cwd: pb.worktree, maxBuffer: 64 * 1024 * 1024 });
		} catch (err) {
			throw new PlanCommandRefusal(
				`${plan} does not land: \`${check}\` failed in ${pb.worktree}\n${(err as Error).message.trim()}`,
			);
		}
	}

	await refuseDirtyTrunk(pb, await branchChanges(pb));
	const merge = await mergeIntoTrunk(pb, `Merge ${pb.branch}: ${plan} landed`);
	await releasePlan(pb.trunk, plan);
	await git(pb.trunk, "worktree", "remove", pb.worktree);
	await git(pb.trunk, "branch", "-d", pb.branch);
	return { plan, merge, checks };
}

function landChecks(trunk: string): string[] {
	const config = readConfig(trunk) as { plans?: { land_checks?: unknown } } | null;
	const checks = config?.plans?.land_checks;
	return Array.isArray(checks) ? checks.filter((c): c is string => typeof c === "string") : [];
}
