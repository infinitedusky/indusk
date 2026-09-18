import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { withLock } from "../agents/lock.js";
import { getPlanningDir, getTrunkBranches } from "../config.js";
import { git, listWorktrees } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import { gitCommonDirOf } from "./layout.js";
import { isWorkbench } from "./repos.js";

/**
 * Which copy of a plan is the live one.
 *
 * Every checkout of a project holds a copy of every plan — the trunk's and
 * one per worktree — and under worktree-per-plan the one being worked is in
 * its worktree, not on the trunk. This module answers "where is plan X's live
 * copy" for every reader (the MCP plan tools, the admin), from any checkout.
 *
 * The answer comes from a record, never from matching names: the InDusk
 * worktree command writes an assignment when it creates or assigns a
 * worktree, and ends it at release. The record lives in the repository's
 * shared git directory — common to the trunk and every worktree of this
 * clone, per-machine like the worktrees it names, never part of any working
 * tree. Each read checks the record against git's own worktree list, and
 * every mismatch is reported as what it is: a worktree that is gone, a plan
 * with two live worktrees, a record that cannot be read. None is guessed.
 *
 * Inert in a workbench: plan documents there live at the workbench root and
 * never in a code worktree, so every plan reads from the plan root.
 */

export const RECORD_FILE = "indusk-plan-worktrees.json";
const RECORD_VERSION = 1;
const PLANNING_REL = join(".indusk", "planning");

export interface Assignment {
	plan: string;
	/** Absolute, realpath-normalized when written. */
	path: string;
	branch: string;
	/** ISO timestamp of the assignment. */
	at: string;
}

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

/** A refusal from `assignPlan`, `releasePlan` or `createPlanWorktree`: the message names what was refused. */
export class PlanWorktreeRefusal extends Error {
	override name = "PlanWorktreeRefusal";
}

type RecordRead =
	| { ok: true; file: string; assignments: Assignment[] }
	| { ok: false; file: string; problem: string };

/** Normalize a path for comparison: realpath when it exists (macOS `/var` ↔ `/private/var`), else resolved. */
function canonical(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

/** Why one assignment is unusable, or null. The reader and the writer share it. */
function assignmentProblem(value: unknown, index: number): string | null {
	if (typeof value !== "object" || value === null) return `assignment ${index} is not an object`;
	const a = value as Record<string, unknown>;
	for (const key of ["plan", "path", "branch", "at"] as const) {
		if (typeof a[key] !== "string" || (a[key] as string).trim() === "") {
			return `assignment ${index} has no ${key}`;
		}
	}
	if (!isUsableSegment(a.plan as string))
		return `assignment ${index} names an unusable plan "${a.plan}"`;
	if (!(a.path as string).startsWith("/"))
		return `assignment ${index} has a relative path "${a.path}"`;
	return null;
}

function parseRecord(text: string, file: string): RecordRead {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (err) {
		return { ok: false, file, problem: `not valid JSON (${(err as Error).message})` };
	}
	if (typeof data !== "object" || data === null)
		return { ok: false, file, problem: "not an object" };
	const body = data as { version?: unknown; assignments?: unknown };
	if (body.version !== RECORD_VERSION) {
		return {
			ok: false,
			file,
			problem: `version is ${JSON.stringify(body.version)}, expected ${RECORD_VERSION}`,
		};
	}
	if (!Array.isArray(body.assignments))
		return { ok: false, file, problem: "assignments is not a list" };
	for (let i = 0; i < body.assignments.length; i++) {
		const problem = assignmentProblem(body.assignments[i], i);
		if (problem) return { ok: false, file, problem };
	}
	return { ok: true, file, assignments: body.assignments as Assignment[] };
}

function recordPath(anyCheckout: string): string {
	const common = gitCommonDirOf(anyCheckout);
	if (!common) throw new PlanWorktreeRefusal(`${anyCheckout} is not inside a git repository`);
	return join(canonical(common), RECORD_FILE);
}

function readRecordFile(file: string): RecordRead {
	if (!existsSync(file)) return { ok: true, file, assignments: [] };
	let text: string;
	try {
		text = readFileSync(file, "utf-8");
	} catch (err) {
		return { ok: false, file, problem: `unreadable (${(err as Error).message})` };
	}
	return parseRecord(text, file);
}

async function readRecord(anyCheckout: string): Promise<RecordRead> {
	return readRecordFile(recordPath(anyCheckout));
}

/**
 * Read the record, decide, and write it back, holding `<record>.lock` across
 * all three. Two sessions assigning at once would otherwise each write the
 * list they read and the later write would drop the earlier assignment — that
 * plan silently reading the trunk again. The lock is the project's lock for
 * processes on one machine (`lib/agents/lock.ts`); `change` returns the new
 * list, or null to write nothing.
 */
function updateRecord<T>(
	anyCheckout: string,
	change: (assignments: Assignment[]) => { next: Assignment[] | null; result: T },
): T {
	const file = recordPath(anyCheckout);
	return withLock(`${file}.lock`, () => {
		const record = readRecordFile(file);
		if (!record.ok) {
			throw new PlanWorktreeRefusal(
				`the assignment record ${record.file} cannot be read: ${record.problem} — fix or remove it first`,
			);
		}
		const { next, result } = change(record.assignments);
		if (next) writeRecord(file, next);
		return result;
	});
}

/** Write the record atomically: a reader never sees half a file. */
function writeRecord(file: string, assignments: Assignment[]): void {
	const temp = `${file}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify({ version: RECORD_VERSION, assignments }, null, 2)}\n`);
	renameSync(temp, file);
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

interface Repository {
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
async function repositoryOf(anyCheckout: string): Promise<Repository | null> {
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

function requirePlan(repo: Repository, plan: string): void {
	if (!isUsableSegment(plan) || !existsSync(join(repo.projectRoot, PLANNING_REL, plan))) {
		throw new PlanWorktreeRefusal(
			`no plan named "${plan}" in ${join(repo.projectRoot, PLANNING_REL)} — a plan is assigned after its folder exists on the trunk`,
		);
	}
}

async function readRecordOrRefuse(
	anyCheckout: string,
): Promise<{ file: string; assignments: Assignment[] }> {
	const record = await readRecord(anyCheckout);
	if (!record.ok) {
		throw new PlanWorktreeRefusal(
			`the assignment record ${record.file} cannot be read: ${record.problem} — fix or remove it first`,
		);
	}
	return record;
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
	requirePlan(repo, plan);
	const path = canonical(worktreePath);
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
): Promise<{ assignment: Assignment; created: string }> {
	const repo = await writableRepository(anyCheckout);
	requirePlan(repo, plan);
	await readRecordOrRefuse(anyCheckout);
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
	const trunkBranch = await git(repo.projectRoot, "branch", "--show-current");
	const allowed = getTrunkBranches(repo.projectRoot);
	if (!allowed.includes(trunkBranch)) {
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
	const assignment = await assignPlan(repo.projectRoot, plan, created);
	return { assignment, created: canonical(created) };
}
