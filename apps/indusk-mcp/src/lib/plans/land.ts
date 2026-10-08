import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { releaseBranchBookkeeping } from "../bookkeeping/migrate.js";
import { readConfig } from "../config.js";
import { git, headSha } from "../git.js";
import { releasePlan } from "../worktree/plan-worktree-commands.js";
import { uncommittedWork } from "./bookkeeping.js";
import {
	branchChanges,
	branchFileChanges,
	implKey,
	implPath,
	mergeIntoTrunk,
	PlanCommandRefusal,
	planBranch,
	refuseDirtyTrunk,
	refuseDirtyWorktree,
	refuseInsideBuildStep,
} from "./plan-branch.js";
import { type WorkbenchPlan, workbenchPlan } from "./workbench-plan.js";

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
 *
 * promise: nothing-ships-until-accepted
 */

export interface LandedPlan {
	plan: string;
	merge: string;
	checks: string[];
}

export interface LandOptions {
	/** Where the running `indusk` is installed; this module's own file when not given. */
	runningFrom?: string;
}

export async function landPlan(
	anyCheckout: string,
	plan: string,
	opts: LandOptions = {},
): Promise<LandedPlan> {
	refuseInsideBuildStep("landed", plan);
	const runningFrom = opts.runningFrom ?? fileURLToPath(import.meta.url);
	const wp = await workbenchPlan(anyCheckout, plan);
	if (wp) return landWorkbenchPlan(wp, runningFrom);
	const pb = await planBranch(anyCheckout, plan);
	const impl = implPath(pb);
	if (!implKey(impl, "accepted")) {
		throw new PlanCommandRefusal(
			`${plan} has not been accepted, so it does not land — accept it first (indusk plans accept ${plan})`,
		);
	}
	refuseRemovingOwnBuild(plan, pb.worktree, pb.trunk, runningFrom);
	await refuseDirtyWorktree(pb);
	releaseBranchBookkeeping(pb.worktree);

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

	await refuseDirtyTrunk(pb, await branchChanges(pb), `before landing ${plan}`);
	const merge = await mergeIntoTrunk(pb, `Merge ${pb.branch}: ${plan} landed`);
	await releasePlan(pb.trunk, plan);
	await git(pb.trunk, "worktree", "remove", pb.worktree);
	await git(pb.trunk, "branch", "-d", pb.branch);
	return { plan, merge, checks };
}

/**
 * Landing a workbench plan (workbench-plan-authoring D7): the code branch
 * reaches its repo's trunk, the same way a normal-mode plan's branch reaches
 * the project's. Refused unaccepted; the repo's trunk is brought into the
 * code branch, the land checks run in the code worktree, the branch merges
 * into the repo's trunk with a merge commit, and the code worktree and its
 * branch are removed. The plan's documents stay at the root, where the
 * retrospective archives them.
 *
 * promise: nothing-ships-until-accepted
 */
async function landWorkbenchPlan(wp: WorkbenchPlan, runningFrom: string): Promise<LandedPlan> {
	const { plan, code, repoTrunk, trunkBranch } = wp;
	if (!implKey(join(wp.dir, "impl.md"), "accepted")) {
		throw new PlanCommandRefusal(
			`${plan} has not been accepted, so it does not land — accept it first (indusk plans accept ${plan})`,
		);
	}
	refuseRemovingOwnBuild(plan, code.worktree, repoTrunk, runningFrom);
	const dirty = await git(code.worktree, "status", "--porcelain");
	if (dirty) {
		throw new PlanCommandRefusal(
			`${plan}'s code worktree ${code.worktree} has uncommitted changes — commit them first:\n${dirty}`,
		);
	}
	try {
		await git(code.worktree, "merge", "--no-edit", trunkBranch);
	} catch (err) {
		await git(code.worktree, "merge", "--abort").catch(() => undefined);
		throw new PlanCommandRefusal(
			`bringing ${trunkBranch} into ${code.branch} conflicts; resolve it in ${code.worktree} and land again: ${(err as Error).message.trim()}`,
		);
	}
	const checks = landChecks(wp.root);
	for (const check of checks) {
		try {
			await execFileAsync("sh", ["-c", check], { cwd: code.worktree, maxBuffer: 64 * 1024 * 1024 });
		} catch (err) {
			throw new PlanCommandRefusal(
				`${plan} does not land: \`${check}\` failed in ${code.worktree}\n${(err as Error).message.trim()}`,
			);
		}
	}
	const paths = (await branchFileChanges(repoTrunk, trunkBranch, code.branch)).map((f) => f.path);
	const work = await uncommittedWork(repoTrunk, paths);
	if (work.length > 0) {
		throw new PlanCommandRefusal(
			`the ${code.repo} trunk at ${repoTrunk} has uncommitted work on paths ${plan} touches, and it may be someone's — commit or move it first: ${work.join(", ")}`,
		);
	}
	try {
		await git(
			repoTrunk,
			"merge",
			"--no-ff",
			"-m",
			`Merge ${code.branch}: ${plan} landed`,
			code.branch,
		);
	} catch (err) {
		await git(repoTrunk, "merge", "--abort").catch(() => undefined);
		throw new PlanCommandRefusal(
			`merging ${code.branch} into ${trunkBranch} failed and was aborted: ${(err as Error).message.trim()}`,
		);
	}
	const merge = await headSha(repoTrunk);
	await git(repoTrunk, "worktree", "remove", code.worktree);
	await git(repoTrunk, "branch", "-d", code.branch);
	return { plan, merge, checks };
}

/**
 * Landing removes the plan's worktree. When the running `indusk` is installed
 * from that worktree — `pnpm install:local` run on the plan's branch links the
 * global install there — the land would delete its own files mid-run and
 * leave the next step's `indusk` dangling (small-fixes A21). Refused before
 * anything is merged, naming the re-link.
 */
function refuseRemovingOwnBuild(
	plan: string,
	worktree: string,
	trunk: string,
	runningFrom: string,
): void {
	const real = (p: string) => {
		try {
			return realpathSync(p);
		} catch {
			return p;
		}
	};
	const rel = relative(real(worktree), real(runningFrom));
	if (rel.startsWith("..") || rel.startsWith("/")) return;
	throw new PlanCommandRefusal(
		`the indusk running this is installed from ${plan}'s worktree (${worktree}), which landing removes. Install from the trunk first — in ${trunk}: pnpm install:local (or npm install -g ./apps/indusk-mcp) — then land again`,
	);
}

function landChecks(trunk: string): string[] {
	const config = readConfig(trunk) as { plans?: { land_checks?: unknown } } | null;
	const checks = config?.plans?.land_checks;
	return Array.isArray(checks) ? checks.filter((c): c is string => typeof c === "string") : [];
}
