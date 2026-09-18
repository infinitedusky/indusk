import { existsSync, readdirSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { getPlanningDir } from "../config.js";
import { git, listWorktrees } from "../git.js";
import { type Assignment, readRecord } from "./plan-worktree-record.js";
import { isWorkbench } from "./repos.js";

export { RECORD_FILE } from "./plan-worktree-record.js";

export interface WorktreeRef {
	/** The worktree's folder name — what a person recognizes. */
	name: string;
	path: string;
	branch: string;
}

/**
 * One plan's live copy. `dir` is the plan folder a reader opens — checked to
 * exist when the copy comes from a worktree, so no reader joins a plan path by
 * hand and none is handed a folder that is not there.
 */
export type PlanCopy =
	| { plan: string; root: string; dir: string; source: "trunk" }
	| {
			plan: string;
			root: string;
			dir: string;
			source: "worktree";
			worktree: WorktreeRef;
			/**
			 * The plan folder has moved into `archive/` in its worktree: the
			 * retrospective archived it on the branch and the landing has not
			 * released it yet. `dir` is the archived folder.
			 */
			archivedInWorktree?: true;
	  }
	| {
			plan: string;
			root: string;
			dir: string;
			source: "trunk";
			/**
			 * Why the trunk copy stands in: the assigned worktree is gone, two
			 * live worktrees claim the plan, or the plan folder is missing from
			 * its worktree.
			 */
			problem: "gone" | "doubled" | "missing";
			/** Names every worktree involved, by path. */
			detail: string;
	  };

/**
 * Where a plan was read from, as every reader reports it: the worktree it was
 * read from (and whether it is archived there), or why the trunk copy stands
 * in. The one definition of these fields — the plan tools return them and the
 * admin's `Plan` carries them, both through `copySource`.
 */
export interface CopySource {
	worktree?: WorktreeRef;
	archivedInWorktree?: true;
	copyProblem?: { kind: "gone" | "doubled" | "missing"; detail: string };
}

/** The report fields for a copy; empty for a plain trunk copy or none. */
export function copySource(copy: PlanCopy | undefined): CopySource {
	if (!copy) return {};
	if (copy.source === "worktree") {
		return copy.archivedInWorktree
			? { worktree: copy.worktree, archivedInWorktree: true }
			: { worktree: copy.worktree };
	}
	if ("problem" in copy) return { copyProblem: { kind: copy.problem, detail: copy.detail } };
	return {};
}

export type PlanCopies =
	| {
			ok: true;
			/** The main working tree — the project, whichever checkout asked. */
			projectRoot: string;
			/** One entry per plan folder on the trunk, archive excluded. */
			copies: Map<string, PlanCopy>;
			/** Worktrees of the repository that hold no live assignment. */
			unassigned: { name: string; path: string; branch: string | null }[];
	  }
	| { ok: false; projectRoot: string; file: string; problem: string };

/** Normalize a path for comparison: realpath when it exists (macOS `/var` ↔ `/private/var`), else resolved. */
/** @internal — shared with the commands module. */
export function canonical(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

/** Plan folders on the trunk, archive excluded — the inventory every copy is resolved for. */
/** The trunk copy of `plan`: its folder in the project's planning dir (the same one `parseAllPlans` reads). */
function trunkCopy(
	projectRoot: string,
	plan: string,
): { plan: string; root: string; dir: string; source: "trunk" } {
	return { plan, root: projectRoot, dir: join(getPlanningDir(projectRoot), plan), source: "trunk" };
}

function trunkPlans(projectRoot: string): string[] {
	const dir = getPlanningDir(projectRoot);
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name !== "archive")
		.map((e) => e.name)
		.sort();
}

/** @internal — shared with the commands module. */
export interface Repository {
	projectRoot: string;
	/** Linked worktrees that exist on disk, keyed by canonical path. */
	linked: Map<string, { path: string; branch: string | null }>;
}

/**
 * The repository whose checkout `anyCheckout` is the top of, or null.
 *
 * Null when it is not in a repository, and also when it is a folder *inside*
 * one — an InDusk project nested in a larger repository. Assignments bind a
 * plan to a whole checkout, and the project's copy in a worktree would be a
 * subfolder of it; resolving that is not done here, so a nested project keeps
 * reading the folder it was asked about. Climbing to the enclosing repository
 * instead would list that repository's plans as this project's.
 */
export async function repositoryOf(anyCheckout: string): Promise<Repository | null> {
	let list: Awaited<ReturnType<typeof listWorktrees>>;
	try {
		const top = await git(anyCheckout, "rev-parse", "--show-toplevel");
		if (canonical(top) !== canonical(anyCheckout)) return null;
		list = await listWorktrees(anyCheckout);
	} catch {
		return null;
	}
	const main = list.find((w) => w.main);
	if (!main) return null;
	const linked = new Map<string, { path: string; branch: string | null }>();
	for (const w of list) {
		if (w.main || w.prunable || !existsSync(w.path)) continue;
		const path = canonical(w.path);
		linked.set(path, { path, branch: w.branch });
	}
	return { projectRoot: canonical(main.path), linked };
}

function trunkCopies(projectRoot: string): Map<string, PlanCopy> {
	return new Map(trunkPlans(projectRoot).map((plan) => [plan, trunkCopy(projectRoot, plan)]));
}

/**
 * One plan's copy from its assignments, and the worktree paths those
 * assignments hold live. No assignment reads the trunk; one live worktree is
 * the copy; several live, or none left of those recorded, read the trunk and
 * say which.
 */
function copyFor(
	plan: string,
	assignments: Assignment[],
	repo: Repository,
): { copy: PlanCopy; live: string[] } {
	const trunk = trunkCopy(repo.projectRoot, plan);
	const mine = assignments.filter((a) => a.plan === plan);
	if (mine.length === 0) return { copy: trunk, live: [] };
	const live = mine.map((a) => canonical(a.path)).filter((path) => repo.linked.has(path));
	if (live.length === 1) {
		const [path] = live;
		const branch = repo.linked.get(path)?.branch ?? mine[0].branch;
		return { copy: worktreeCopy(plan, path, branch, trunk), live };
	}
	if (live.length > 1) {
		return {
			copy: {
				...trunk,
				problem: "doubled",
				detail: `two live worktrees are assigned to ${plan}: ${live.join(", ")}`,
			},
			live,
		};
	}
	return {
		copy: {
			...trunk,
			problem: "gone",
			detail: `assigned worktree ${mine.map((a) => a.path).join(", ")} no longer exists`,
		},
		live,
	};
}

/**
 * The copy in a live assigned worktree, found on disk: the active plan folder,
 * else the archived one (the retrospective moves it on the branch before the
 * landing releases), else the trunk's copy with the folder reported missing.
 */
function worktreeCopy(
	plan: string,
	path: string,
	branch: string,
	trunk: ReturnType<typeof trunkCopy>,
): PlanCopy {
	const worktree = { name: basename(path), path, branch };
	const planning = getPlanningDir(path);
	const active = join(planning, plan);
	if (existsSync(active)) return { plan, root: path, dir: active, source: "worktree", worktree };
	const archived = join(planning, "archive", plan);
	if (existsSync(archived)) {
		return {
			plan,
			root: path,
			dir: archived,
			source: "worktree",
			worktree,
			archivedInWorktree: true,
		};
	}
	return {
		...trunk,
		problem: "missing",
		detail: `plan folder missing in worktree ${path} (neither ${active} nor ${archived} exists)`,
	};
}

/**
 * Every plan's live copy, asked from any checkout of the project.
 *
 * A plan with no assignment reads from the trunk. One live assignment reads
 * from its worktree. Two live assignments, or assignments whose worktrees
 * are all gone, read from the trunk and say why. A record that cannot be
 * read is `ok: false` — there is no copy map to misuse.
 */
export async function resolvePlanCopies(anyCheckout: string): Promise<PlanCopies> {
	const asked = canonical(anyCheckout);
	if (isWorkbench(asked)) {
		return { ok: true, projectRoot: asked, copies: trunkCopies(asked), unassigned: [] };
	}
	const repo = await repositoryOf(asked);
	if (!repo) return { ok: true, projectRoot: asked, copies: trunkCopies(asked), unassigned: [] };

	const record = await readRecord(asked);
	if (!record.ok)
		return { ok: false, projectRoot: repo.projectRoot, file: record.file, problem: record.problem };

	const copies = new Map<string, PlanCopy>();
	const claimed = new Set<string>();
	for (const plan of trunkPlans(repo.projectRoot)) {
		const { copy, live } = copyFor(plan, record.assignments, repo);
		copies.set(plan, copy);
		for (const path of live) claimed.add(path);
	}
	const unassigned = [...repo.linked.values()]
		.filter((w) => !claimed.has(w.path))
		.map((w) => ({ name: basename(w.path), path: w.path, branch: w.branch }));
	return { ok: true, projectRoot: repo.projectRoot, copies, unassigned };
}

/** One plan's live copy. A plan with no trunk folder resolves to the trunk, where every reader already reports it missing. */
export async function livePlanCopy(
	anyCheckout: string,
	plan: string,
): Promise<{ ok: true; copy: PlanCopy } | { ok: false; file: string; problem: string }> {
	const all = await resolvePlanCopies(anyCheckout);
	if (!all.ok) return { ok: false, file: all.file, problem: all.problem };
	return {
		ok: true,
		copy: all.copies.get(plan) ?? trunkCopy(all.projectRoot, plan),
	};
}
