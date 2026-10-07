import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentSection } from "../agents/current-md.js";
import { parseCurrentMd, upsertSection } from "../agents/current-md.js";
import { withLock } from "../agents/lock.js";
import { getTrunkBranches } from "../config.js";
import { bookkeepingRoots } from "./roots.js";

export type NoteCommit = { committed: true } | { committed: false; reason: string };

/**
 * Commit InDusk's notes on `main` as they are written
 * (bookkeeping-lives-where-it-is-read D2): only the given paths, so anything a
 * person has staged stays staged and out of the commit; only when the main
 * checkout is on its trunk branch with no merge, rebase, cherry-pick or revert
 * in progress. Otherwise the note stays written and uncommitted, and the
 * reason says why. Callers hold the `current.md` lock; this takes none.
 *
 * promise: indusk-leaves-main-clean
 */
export function commitNote(trunk: string, paths: string[], message: string): NoteCommit {
	const gitDir = git(trunk, "rev-parse", "--absolute-git-dir");
	if (gitDir.code !== 0) return { committed: false, reason: `${trunk} is not a git checkout` };
	const dir = gitDir.out;
	for (const [marker, what] of IN_PROGRESS) {
		if (existsSync(join(dir, marker))) {
			return { committed: false, reason: `${what} is in progress in the main checkout` };
		}
	}
	const branch = git(trunk, "symbolic-ref", "--short", "-q", "HEAD").out;
	if (!getTrunkBranches(trunk).includes(branch)) {
		return {
			committed: false,
			reason: `the main checkout is on ${branch || "a detached HEAD"}, not its trunk branch`,
		};
	}
	const add = git(trunk, "add", "--", ...paths);
	if (add.code !== 0) return { committed: false, reason: `git add failed: ${add.err}` };
	if (git(trunk, "diff", "--cached", "--quiet", "--", ...paths).code === 0)
		return { committed: true };
	const commit = git(trunk, "commit", "--only", "-q", "-m", message, "--", ...paths);
	if (commit.code !== 0) return { committed: false, reason: `git commit failed: ${commit.err}` };
	return { committed: true };
}

const IN_PROGRESS: Array<[string, string]> = [
	["MERGE_HEAD", "a merge"],
	["CHERRY_PICK_HEAD", "a cherry-pick"],
	["REVERT_HEAD", "a revert"],
	["rebase-merge", "a rebase"],
	["rebase-apply", "a rebase"],
];

function git(cwd: string, ...args: string[]): { code: number; out: string; err: string } {
	const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
	return { code: r.status ?? -1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/** The main checkout's `current.md`, whichever checkout asks. */
export function currentMdPath(anyCheckout: string): string {
	return join(bookkeepingRoots(anyCheckout).trunk, CURRENT_MD);
}

/** Commit `current.md` (and any other notes given) on `main`; call inside the `current.md` lock. */
export function commitCurrentMd(
	anyCheckout: string,
	what: string,
	also: string[] = [],
): NoteCommit {
	return commitNote(
		bookkeepingRoots(anyCheckout).trunk,
		[CURRENT_MD, ...also],
		`chore(indusk): current.md — ${oneLine(what)}`,
	);
}

const CURRENT_MD = join(".indusk", "current.md");

function oneLine(text: string): string {
	const line = text.replace(/\s+/g, " ").trim();
	return line.length > 72 ? `${line.slice(0, 71)}…` : line;
}

export interface CurrentSectionInput {
	sessionId: string;
	task: string;
	inFlight: string;
	openQuestions: string;
	cursor: string;
}

/**
 * Write one session's section of the main checkout's `current.md`, and commit
 * it on `main` (bookkeeping-lives-where-it-is-read D2), from any checkout.
 *
 * promise: indusk-leaves-main-clean
 */
export function writeCurrentSection(
	anyCheckout: string,
	input: CurrentSectionInput,
): { section: AgentSection; commit: NoteCommit } {
	const path = currentMdPath(anyCheckout);
	mkdirSync(dirname(path), { recursive: true });
	let section!: AgentSection;
	let commit!: NoteCommit;
	withLock(`${path}.lock`, () => {
		const initial = existsSync(path) ? readFileSync(path, "utf-8") : "";
		const existing = parseCurrentMd(initial).sections.find((s) => s.sessionId === input.sessionId);
		section = {
			sessionId: input.sessionId,
			sessionShort: input.sessionId.slice(0, 8),
			task: input.task,
			lastUpdated: new Date().toISOString(),
			inFlight: input.inFlight,
			openQuestions: input.openQuestions,
			cursor: input.cursor,
			branch: existing?.branch ?? "",
			worktree: existing?.worktree ?? "",
		};
		const tmpPath = `${path}.tmp.${input.sessionId}`;
		writeFileSync(tmpPath, upsertSection(initial, section));
		renameSync(tmpPath, path);
		commit = commitCurrentMd(anyCheckout, `${section.sessionShort} ${input.task}`);
	});
	return { section, commit };
}

export interface LessonInput {
	name: string;
	title: string;
	content: string;
}

/**
 * Add a lesson to the main checkout's lessons and commit it on `main`, from
 * any checkout; refuses one that already exists.
 *
 * promise: indusk-leaves-main-clean
 */
export function addLesson(
	anyCheckout: string,
	input: LessonInput,
): { file: string; commit: NoteCommit } | { error: string } {
	const { trunk } = bookkeepingRoots(anyCheckout);
	const rel = join(".claude", "lessons");
	mkdirSync(join(trunk, rel), { recursive: true });
	const fileName = input.name.startsWith("community-")
		? input.name.replace("community-", "")
		: input.name;
	const file = join(trunk, rel, `${fileName}.md`);
	mkdirSync(dirname(currentMdPath(anyCheckout)), { recursive: true });
	return withLock(`${currentMdPath(anyCheckout)}.lock`, () => {
		if (existsSync(file)) return { error: `Lesson ${fileName}.md already exists` };
		writeFileSync(file, `# ${input.title}\n\n${input.content}\n`);
		const commit = commitNote(
			trunk,
			[join(rel, `${fileName}.md`)],
			`chore(indusk): lesson — ${fileName}`,
		);
		return { file, commit };
	});
}
