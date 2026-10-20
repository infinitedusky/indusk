import { getTrunkBranches } from "../config.js";
import { isAlive, type ProcessDeps, type PsRow, parsePsAll } from "../process-identity.js";
import { type Exec, type StartOptions, startProgram } from "../start-program.js";
import { pickTrunk } from "../trunk-branch.js";
import { declaredRepoDirs, isWorkbench } from "../worktree/repos.js";
import { type Kept, type KeptDeps, keptRead } from "./kept-reads.js";
import {
	codeRepoSpec,
	type GitReads,
	isLandingOf,
	landedOnMain,
	trunkBranchesOf,
} from "./landed.js";

/**
 * The reads a page makes, without stopping the server (admin-pages-load-fast, decisions 2, 6, 7,
 * 15, 19): the machine's process list and a repository's landing history, started
 * asynchronously, given up on at `READ_TIMEOUT_MS`, kept briefly through `keptRead`, and
 * answered to the existing synchronous rules in the shapes they already take. `psAll`,
 * `landedAsker` and `trunkMergeSubjects` stay for the command line.
 *
 * clause: admin-pages-load-fast/never-freezes
 * clause: admin-pages-load-fast/one-read-per-page
 */

/** What every reader here takes: the program runner and the clock are inputs. */
export interface ReadDeps extends KeptDeps {
	exec?: Exec;
}
const startIn = (deps: ReadDeps, cwd?: string): StartOptions => ({
	...(cwd === undefined ? {} : { cwd }),
	...(deps.exec === undefined ? {} : { exec: deps.exec }),
});

export { countStarts, type Exec, READ_TIMEOUT_MS, startProgram } from "../start-program.js";

// ── the process list ────────────────────────────────────────────────────────────────────────────

/** The machine's process list in one `ps`; `null` when it failed or did not answer (liveness then reads unknown). */
export async function readProcessTable(deps: ReadDeps = {}): Promise<PsRow[] | null> {
	try {
		const out = await startProgram("ps", ["-axo", "pid=,lstart=,command="], {
			...startIn(deps),
			env: { ...process.env, LC_ALL: "C" },
			maxBuffer: 32 * 1024 * 1024,
		});
		return parsePsAll(out);
	} catch {
		return null;
	}
}

/** The process list, kept; throws when it could not be read so a failure is never kept. */
export function keptProcessTable(deps: ReadDeps = {}): Promise<Kept<PsRow[]>> {
	return keptRead(
		"ps",
		async () => {
			const table = await readProcessTable(deps);
			if (table === null) throw new Error("the process list could not be read");
			return table;
		},
		deps,
	);
}

/**
 * `ProcessDeps` answered from the one table: `alive` is signal 0 (starts nothing), the command
 * and start time come from the pid's row. A table that is `null`, or lacks a live pid (it may
 * predate the process), makes that pid `unreadable`, so `runStatus` reads it unknown, not stopped.
 */
export function processReadsFromTable(table: readonly PsRow[] | null): Required<ProcessDeps> {
	const row = (pid: number) => table?.find((r) => r.pid === pid);
	return {
		alive: isAlive,
		command: (pid) => row(pid)?.command ?? null,
		startTime(pid) {
			const at = row(pid)?.startedAt;
			return at ? new Date(at) : null;
		},
		unreadable: (pid) => isAlive(pid) && row(pid) === undefined,
	};
}

// ── the trunk's landing history ─────────────────────────────────────────────────────────────────

const refOf = (trunk: string) => (trunk === "HEAD" ? "HEAD" : `refs/heads/${trunk}`);
const ARCHIVE = ".indusk/planning/archive/";

/** Subjects of the merge commits on `trunk`, in one `git log`. */
export async function readMergeSubjects(
	dir: string,
	trunk: string,
	deps: ReadDeps = {},
): Promise<string[]> {
	const out = await startProgram(
		"git",
		["log", refOf(trunk), "--merges", "--format=%s"],
		startIn(deps, dir),
	);
	return out.split("\n").filter(Boolean);
}

/** The plan folders in the trunk's archive, in one non-recursive `git ls-tree`. */
async function readArchived(dir: string, trunk: string, deps: ReadDeps): Promise<Set<string>> {
	const out = await startProgram(
		"git",
		["ls-tree", "--name-only", refOf(trunk), ARCHIVE],
		startIn(deps, dir),
	);
	return new Set(out.split("\n").filter(Boolean));
}

/** The local branches of the repository at `dir`, in one `git for-each-ref`. */
async function readBranches(dir: string, deps: ReadDeps): Promise<Set<string>> {
	const out = await startProgram(
		"git",
		["for-each-ref", "--format=%(refname:short)", "refs/heads"],
		startIn(deps, dir),
	);
	return new Set(out.split("\n").filter(Boolean));
}

const kept = <T>(key: string, read: () => Promise<T>, deps: ReadDeps) => keptRead(key, read, deps);
const subjectsKey = (dir: string, trunk: string) => `landings:${dir}\0${trunk}`;
const keptSubjects = (dir: string, trunk: string, deps: ReadDeps) =>
	kept(subjectsKey(dir, trunk), () => readMergeSubjects(dir, trunk, deps), deps);
const keptBranches = (dir: string, deps: ReadDeps) =>
	kept(`branches:${dir}`, () => readBranches(dir, deps), deps);

/**
 * The trunk of the repository at `dir` among `allowed`, the way `landed.ts` picks it: the
 * checked-out branch when it is a trunk branch, else the first that exists, else the checkout's own.
 */
async function trunkOfAsync(
	dir: string,
	allowed: readonly string[],
	deps: ReadDeps,
): Promise<string> {
	let current = "";
	try {
		current = (await startProgram("git", ["branch", "--show-current"], startIn(deps, dir))).trim();
	} catch {
		// not a repository, or git did not answer: the reads below fail and say not landed
	}
	if (current !== "" && allowed.includes(current)) return current;
	let branches = new Set<string>();
	try {
		branches = (await keptBranches(dir, deps)).value;
	} catch {
		// no branch listing: nothing is known to exist
	}
	return pickTrunk(current, allowed, (b) => branches.has(b)) ?? (current || "HEAD");
}

interface RepoLandings {
	/** `null` when the log could not be read: every plan reads not landed. */
	subjects: readonly string[] | null;
}

async function readRepo(
	dir: string,
	allowed: readonly string[],
	deps: ReadDeps,
	withArchive: boolean,
): Promise<RepoLandings & { trunk: string; archived: ReadonlySet<string> }> {
	const trunk = await trunkOfAsync(dir, allowed, deps);
	const [subjects, archived] = await Promise.all([
		keptSubjects(dir, trunk, deps).then(
			(k) => k.value,
			() => null,
		),
		withArchive
			? kept(`archive:${dir}\0${trunk}`, () => readArchived(dir, trunk, deps), deps).then(
					(k) => k.value,
					() => new Set<string>(),
				)
			: Promise.resolve(new Set<string>()),
	]);
	return { trunk, subjects, archived };
}

/**
 * "Has this plan landed" for every plan, from one reading per repository, the answer
 * `landedAsker` gives (A6): the root's trunk log and archive folder, and for a workbench each
 * declared repository's trunk log (the plan's `code.json` picks the repository). A log that
 * cannot be read reads every plan not landed, as `landedOnMain` does when git throws.
 */
export async function readLandings(
	root: string,
	deps: ReadDeps = {},
): Promise<(plan: string) => boolean> {
	const rootRead = await readRepo(root, getTrunkBranches(root), deps, true);
	const repos = new Map<string, RepoLandings>();
	if (isWorkbench(root)) {
		await Promise.all(
			declaredRepoDirs(root).map(async ({ name, dir }) => {
				repos.set(dir, await readRepo(dir, trunkBranchesOf(root, name), deps, false));
			}),
		);
	}
	const git: GitReads = {
		mergeSubjects() {
			if (rootRead.subjects === null) throw new Error("the trunk's log could not be read");
			return [...rootRead.subjects];
		},
		hasPath: (_trunk, path) => rootRead.archived.has(path),
	};
	return (plan) => {
		try {
			if (landedOnMain(rootRead.trunk, plan, git)) return true;
			const code = codeRepoSpec(root, plan);
			if (code === null) return false;
			const repo = repos.get(code.dir);
			return repo?.subjects?.some((s) => isLandingOf(s, plan)) ?? false;
		} catch {
			return false;
		}
	};
}

/**
 * The reporting path's merge subjects (`trunkMergeSubjects`): every existing trunk branch's
 * log joined, else HEAD's. Reads through the same kept key as `readLandings`, so a page that
 * asks both makes one `git log … --merges`.
 */
export async function trunkMergeSubjectsAsync(
	root: string,
	deps: ReadDeps = {},
): Promise<string[]> {
	const out: string[] = [];
	let branches = new Set<string>();
	try {
		branches = (await keptBranches(root, deps)).value;
	} catch {
		// no listing: fall through to HEAD
	}
	const wanted = getTrunkBranches(root).filter((b) => branches.has(b));
	const logs = await Promise.all(
		wanted.map((b) =>
			keptSubjects(root, b, deps).then(
				(k) => k.value,
				() => [] as string[],
			),
		),
	);
	for (const subjects of logs) out.push(...subjects);
	if (out.length > 0) return out;
	try {
		return (await keptSubjects(root, "HEAD", deps)).value;
	} catch {
		return [];
	}
}
