import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPlanningDir } from "../config.js";
import { git } from "../git.js";
import { currentTrunkBranch } from "../trunk-branch.js";
import { resolvePlanCopies } from "../worktree/plan-worktrees.js";
import { isWorkbench } from "../worktree/repos.js";
import { chooseCodeRepo, codeRepoBase, type PlanCode, readPlanCode } from "../worktree/roots.js";
import { PlanCommandRefusal } from "./plan-branch.js";

/**
 * A plan in a workbench, as the plan commands act on it
 * (workbench-plan-authoring D2, D3, D7). Its documents live at the workbench
 * root, which is the root's own git repository; its code is on a branch in
 * the repo its `code.json` names. Where a normal-mode plan has one branch for
 * both, this has the root for the documents and the repo for the code, and
 * every verb reads the code from the plan's record, never by name.
 *
 * promise: a-plan-knows-its-code
 */
export interface WorkbenchPlan {
	plan: string;
	/** The workbench root: the plan's documents live here, on the root's own branch. */
	root: string;
	/** The plan's folder at the root. */
	dir: string;
	/** What `code.json` names, the worktree absolute. */
	code: PlanCode;
	/** The repo's trunk checkout. */
	repoTrunk: string;
	/** The branch the repo's trunk checkout is on, one of its trunk branches. */
	trunkBranch: string;
}

/**
 * The workbench plan `plan`, or null when the project is not a workbench.
 * Refuses, naming what is missing, when the plan has no folder or no code
 * file, the code file names a worktree that is gone, or the repo's trunk is
 * not on a trunk branch.
 */
export async function workbenchPlan(
	anyCheckout: string,
	plan: string,
): Promise<WorkbenchPlan | null> {
	const copies = await resolvePlanCopies(anyCheckout);
	const root = copies.ok ? copies.projectRoot : anyCheckout;
	if (!isWorkbench(root)) return null;
	const dir = join(getPlanningDir(root), plan);
	if (!existsSync(dir)) throw new PlanCommandRefusal(`no plan named ${plan} in this workbench`);
	const read = readPlanCode(root, plan);
	if (read === null) {
		throw new PlanCommandRefusal(
			`${plan} has no code.json, so it does not say which repo holds its code — a workbench plan is started with \`indusk plans start\``,
		);
	}
	if (!read.ok) throw new PlanCommandRefusal(read.problem);
	const repo = chooseCodeRepo(root, read.code.repo);
	if ("error" in repo) throw new PlanCommandRefusal(repo.error);
	// The branch the plan lands on: the repo's declared base branch when its
	// worktree config names one, else the project's trunk branches.
	const trunk = await currentTrunkBranch(repo.dir);
	const base = codeRepoBase(root, repo.name);
	const allowed = base ? [base] : trunk.allowed;
	if (!allowed.includes(trunk.branch)) {
		throw new PlanCommandRefusal(
			`the ${repo.name} checkout at ${repo.dir} is on ${trunk.branch || "no branch"}, but ${plan} lands on ${allowed.join(" or ")} — check that branch out there first`,
		);
	}
	return { plan, root, dir, code: read.code, repoTrunk: repo.dir, trunkBranch: trunk.branch };
}

/**
 * Commit `paths` at the workbench root, alone, under `message` (D8): the plan
 * commands commit their own writes at once, and the root's sync loop carries
 * and pushes them. Nothing to commit is not an error.
 */
export async function commitAtRoot(root: string, paths: string[], message: string): Promise<void> {
	const present = paths.filter((p) => existsSync(join(root, p)));
	if (present.length === 0) return;
	await git(root, "add", "--", ...present);
	const staged = await git(root, "diff", "--cached", "--name-only", "--", ...present);
	if (!staged) return;
	await git(root, "commit", "-q", "-m", message, "--", ...present);
}
