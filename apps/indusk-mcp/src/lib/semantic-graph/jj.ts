/**
 * Jj integration for the semantic graph.
 *
 * Every event in the log is tagged with the jj change ID active when it was
 * written. Replay filters by jj ancestry of the current HEAD — this is how
 * branch/rebase/amend safety works without per-branch anchor forking.
 *
 * See `.indusk/planning/cgc-graphiti-bridge/adr.md` Decision #2.
 */

import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Thrown when the sync pipeline runs in a directory that isn't a jj repo or
 * when `jj` is not on PATH. Callers decide whether to fail hard or fall back.
 * v1 fails hard — the semantic graph bridge requires jj as its versioning
 * substrate; a git-only fallback is future work.
 */
export class NotAJjRepoError extends Error {
	constructor(cwd: string, cause?: unknown) {
		super(`Not a jj repository (or jj not on PATH): ${cwd}`);
		this.name = "NotAJjRepoError";
		if (cause !== undefined) {
			(this as { cause?: unknown }).cause = cause;
		}
	}
}

type JjRunner = (args: string[], cwd: string) => Promise<string>;

/**
 * Default runner. Invokes `jj` via execFile and returns stdout.
 * Injectable via `setJjRunner` for tests.
 */
const defaultRunner: JjRunner = async (args, cwd) => {
	try {
		const { stdout } = await execFileAsync("jj", args, { cwd });
		return stdout;
	} catch (err) {
		const execErr = err as ExecFileException;
		// ENOENT = jj not on PATH; non-zero exit usually means not a jj repo
		if (execErr.code === "ENOENT" || typeof execErr.code === "number") {
			throw new NotAJjRepoError(cwd, err);
		}
		throw err;
	}
};

let runner: JjRunner = defaultRunner;

/** Override the jj runner. Tests use this to inject canned output. */
export function setJjRunner(next: JjRunner): void {
	runner = next;
}

/** Reset to the real jj runner. Tests call this in afterEach. */
export function resetJjRunner(): void {
	runner = defaultRunner;
}

const CHANGE_ID_PATTERN = /^[a-z]+$/;

function validateChangeId(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.length === 0 || !CHANGE_ID_PATTERN.test(trimmed)) {
		throw new Error(`Invalid jj change id: ${JSON.stringify(raw)}`);
	}
	return trimmed;
}

/**
 * Return the jj change ID of the current working-copy change (`@`).
 *
 * This is the ID that should be stamped on every event produced during this
 * session until the user runs `jj new`.
 */
export async function getCurrentChangeId(cwd: string): Promise<string> {
	const stdout = await runner(["log", "-r", "@", "--no-graph", "--template", "change_id"], cwd);
	return validateChangeId(stdout);
}

/**
 * Return the set of change IDs reachable from the current HEAD — i.e. the
 * current change and all its ancestors. This is the ancestry filter that
 * replay uses to decide which events apply to the current view of the graph.
 *
 * Equivalent to `jj log -r '::@'`. Excludes any events tagged with change IDs
 * that are not ancestors of HEAD (sibling branches, abandoned work).
 */
export async function getReachableChangeIds(cwd: string): Promise<Set<string>> {
	const stdout = await runner(
		["log", "-r", "::@", "--no-graph", "--template", 'change_id ++ "\n"'],
		cwd,
	);
	const set = new Set<string>();
	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		set.add(validateChangeId(trimmed));
	}
	if (set.size === 0) {
		throw new Error("jj ancestry query returned no change IDs (empty repo?)");
	}
	return set;
}

/** Convenience: is this change ID in the reachable set? */
export function isChangeReachable(changeId: string, reachable: Set<string>): boolean {
	return reachable.has(changeId);
}
