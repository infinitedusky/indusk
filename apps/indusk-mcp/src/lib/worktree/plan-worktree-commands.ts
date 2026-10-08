import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { git } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import { openMaintenancePhasesIn, ownerDir } from "../promises/reopen.js";
import { currentTrunkBranch } from "../trunk-branch.js";
import {
	type Assignment,
	PlanWorktreeRefusal,
	readRecord,
	refuseUnreadable,
	updateRecord,
} from "./plan-worktree-record.js";
import { canonical, type Repository, repositoryOf } from "./plan-worktrees.js";
import { isWorkbench } from "./repos.js";

export { PlanWorktreeRefusal } from "./plan-worktree-record.js";

/**
 * The commands that make and end a plan's worktree assignment — `create`,
 * `assign`, `release` — and every refusal they give. Each names what it
 * refused and writes nothing. The record itself is `plan-worktree-record.ts`;
 * which copy a reader gets is the resolver's (`plan-worktrees.ts`).
 */

const PLANNING_REL = join(".indusk", "planning");

/** The repository for a write, refusing where assignments do not apply. */
async function writableRepository(anyCheckout: string): Promise<Repository> {
	const asked = canonical(anyCheckout);
	if (isWorkbench(asked)) {
		throw new PlanWorktreeRefusal(
			"plan worktree assignments are for normal-mode projects: in a workbench, plan documents live at the workbench root, never in a code worktree",
		);
	}
	const repo = await repositoryOf(asked);
	if (!repo) throw new PlanWorktreeRefusal(`${asked} is not inside a git repository`);
	return repo;
}

/**
 * A plan is assigned once its folder exists — on the trunk, or in the
 * worktree being assigned. The second is a plan written on its own branch
 * (admin-plan-authoring): it has no folder on the trunk until it is approved.
 * An archived plan is assigned only while an incident has reopened it — an
 * open Maintenance phase in its impl, found as `watch` writes it
 * (`ownerDir`); a closed one is refused, saying how a plan reopens.
 */
function requirePlan(repo: Repository, plan: string, worktree?: string): void {
	if (!isUsableSegment(plan)) {
		throw new PlanWorktreeRefusal(`"${plan}" is not a usable plan name`);
	}
	const roots = worktree ? [repo.projectRoot, worktree] : [repo.projectRoot];
	if (roots.some((root) => existsSync(join(root, PLANNING_REL, plan)))) return;
	const archived = roots
		.map((root) => ownerDir(root, plan))
		.filter((dir): dir is string => dir !== null);
	if (archived.some((dir) => openMaintenancePhasesIn(dir).length > 0)) return;
	if (archived.length > 0) {
		throw new PlanWorktreeRefusal(
			`${plan} is archived (${archived[0]}) and has no open Maintenance phase — a closed plan reopens when an incident against one of its promises is recorded (indusk promises watch), not by creating a worktree`,
		);
	}
	throw new PlanWorktreeRefusal(
		`no plan named "${plan}" in ${roots.map((root) => join(root, PLANNING_REL)).join(" or ")} — a plan is assigned after its folder exists`,
	);
}

/**
 * Assign `plan` to the worktree at `worktreePath`. Idempotent for the same
 * worktree. Refuses a path that is not a linked worktree of this repository,
 * a plan with no folder on the trunk, a plan that already has another live
 * worktree, and a worktree already assigned to another plan — each by name,
 * with nothing written. Assignments whose worktrees are gone are replaced.
 */
export async function assignPlan(
	anyCheckout: string,
	plan: string,
	worktreePath: string,
): Promise<Assignment> {
	const repo = await writableRepository(anyCheckout);
	const path = canonical(worktreePath);
	requirePlan(repo, plan, path);
	const target = repo.linked.get(path);
	if (!target) {
		throw new PlanWorktreeRefusal(
			`${worktreePath} is not a worktree of this repository (git worktree list, from ${repo.projectRoot})`,
		);
	}
	const live = (a: Assignment) => repo.linked.has(canonical(a.path));
	return updateRecord(anyCheckout, (assignments) => {
		const existing = assignments.find((a) => a.plan === plan && live(a));
		if (existing && canonical(existing.path) === path) return { next: null, result: existing };
		if (existing) {
			throw new PlanWorktreeRefusal(
				`${plan} is already assigned to ${existing.path}; refusing to also assign ${path} — release it first (indusk worktree release ${plan})`,
			);
		}
		const holder = assignments.find(
			(a) => a.plan !== plan && live(a) && canonical(a.path) === path,
		);
		if (holder) {
			throw new PlanWorktreeRefusal(`${path} is already assigned to plan ${holder.plan}`);
		}
		const assignment: Assignment = {
			plan,
			path,
			branch: target.branch ?? "(detached)",
			at: new Date().toISOString(),
		};
		return {
			next: [...assignments.filter((a) => a.plan !== plan), assignment],
			result: assignment,
		};
	});
}

/** End `plan`'s assignment. Refuses when there is none, so a skipped step is loud. */
export async function releasePlan(anyCheckout: string, plan: string): Promise<Assignment[]> {
	await writableRepository(anyCheckout);
	return updateRecord(anyCheckout, (assignments) => {
		const released = assignments.filter((a) => a.plan === plan);
		if (released.length === 0) {
			throw new PlanWorktreeRefusal(`${plan} has no worktree assignment to release`);
		}
		return { next: assignments.filter((a) => a.plan !== plan), result: released };
	});
}

/**
 * Create `plan`'s worktree in a normal-mode project and assign it:
 * `git worktree add <parent>/<project>-worktrees/<plan> -b plan/<plan> <trunk branch>`.
 * The folder and branch names are for people; nothing reads them to decide
 * anything — the assignment is what binds the plan.
 */
export async function createPlanWorktree(
	anyCheckout: string,
	plan: string,
	opts: {
		/**
		 * Write the plan's first documents in the new worktree before it is
		 * assigned — `plans start`, whose plan has no folder on the trunk.
		 * Without it the plan must already be on the trunk.
		 */
		seed?: (worktree: string) => void;
	} = {},
): Promise<{ assignment: Assignment; created: string }> {
	const repo = await writableRepository(anyCheckout);
	if (!opts.seed) requirePlan(repo, plan);
	else if (!isUsableSegment(plan))
		throw new PlanWorktreeRefusal(`"${plan}" is not a usable plan name`);
	const record = await readRecord(anyCheckout);
	if (!record.ok) refuseUnreadable(record);
	const created = join(dirname(repo.projectRoot), `${basename(repo.projectRoot)}-worktrees`, plan);
	if (existsSync(created)) {
		// Advise `assign` only for something `assign` would take: a linked
		// worktree of this repository. Anything else is usually what a removed
		// worktree left behind (ignored files `git worktree remove --force` keeps).
		throw new PlanWorktreeRefusal(
			repo.linked.has(canonical(created))
				? `${created} is already a worktree of this repository — assign it with indusk worktree assign ${plan} ${created}`
				: `${created} already exists and is not a worktree of this repository (often what a removed worktree leaves behind) — remove it, then run create again`,
		);
	}
	const { branch: trunkBranch, allowed, onTrunk } = await currentTrunkBranch(repo.projectRoot);
	if (!onTrunk) {
		throw new PlanWorktreeRefusal(
			`the trunk at ${repo.projectRoot} is on ${trunkBranch ? `branch ${trunkBranch}` : "no branch"}, not a trunk branch (${allowed.join(", ")}) — a plan branch forks from the trunk; check out the trunk branch first, or list this one in worktree.trunk_guard.branches`,
		);
	}
	try {
		await git(
			repo.projectRoot,
			"worktree",
			"add",
			"-q",
			created,
			"-b",
			`plan/${plan}`,
			trunkBranch,
		);
	} catch (err) {
		throw new PlanWorktreeRefusal(`git worktree add failed: ${(err as Error).message.trim()}`);
	}
	opts.seed?.(canonical(created));
	const assignment = await assignPlan(repo.projectRoot, plan, created);
	return { assignment, created: canonical(created) };
}
