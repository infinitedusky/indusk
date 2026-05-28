/**
 * SCM-aware versions of the change-ID and ancestry functions that the
 * semantic graph (and any future SCM-coupled surface) needs.
 *
 * Branches on `getScm(projectRoot)`:
 * - `"jj"` — delegates to `lib/semantic-graph/jj.ts` (preserves existing behavior).
 * - `"git"` — uses `git rev-parse --short HEAD` and `git log --format=%h HEAD`.
 *
 * Callers should use these instead of importing from `lib/semantic-graph/jj`
 * directly. The jj module is now an internal implementation detail of the
 * jj branch.
 */

import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	getCurrentChangeId as getJjChangeId,
	getReachableChangeIds as getJjReachable,
} from "../semantic-graph/jj.js";
import { getScm } from "./detect.js";

export type { ScmKind } from "./detect.js";
export { detectScm, getScm, NoScmDetectedError } from "./detect.js";

const execFileAsync = promisify(execFile);

const GIT_HASH_PATTERN = /^[a-f0-9]+$/;

function validateGitHash(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.length === 0 || !GIT_HASH_PATTERN.test(trimmed)) {
		throw new Error(`Invalid git short SHA: ${JSON.stringify(raw)}`);
	}
	return trimmed;
}

/**
 * Return the change ID active at the current working copy. SCM-aware.
 * - jj: change_id template — survives rebase/amend/split.
 * - git: short SHA from `git rev-parse --short HEAD` — does NOT survive
 *   rewrites (caller's problem; v1 of the semantic graph deliberately
 *   graceful-degrades on git so this only matters once we lift that limit).
 *
 * Throws if the SCM operation itself fails (no jj repo, no git repo, no
 * commits yet, etc.). Callers in graceful-degrade paths must handle.
 */
export async function getCurrentChangeId(projectRoot: string): Promise<string> {
	const scm = getScm(projectRoot);
	if (scm === "jj") return getJjChangeId(projectRoot);
	const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
		cwd: projectRoot,
	});
	return validateGitHash(stdout);
}

/**
 * Return the set of change IDs reachable from the current HEAD — the
 * current change + all ancestors. SCM-aware.
 * - jj: ancestry via `jj log -r '::@'`.
 * - git: ancestry via `git log --format=%h HEAD` (linear history walk).
 */
export async function getReachableChangeIds(projectRoot: string): Promise<Set<string>> {
	const scm = getScm(projectRoot);
	if (scm === "jj") return getJjReachable(projectRoot);
	let stdout: string;
	try {
		const result = await execFileAsync("git", ["log", "--format=%h", "HEAD"], {
			cwd: projectRoot,
		});
		stdout = result.stdout;
	} catch (err) {
		const execErr = err as ExecFileException;
		// no commits yet, no HEAD — return empty set rather than throwing.
		// Callers iterate this set; an empty ancestor set is harmless.
		if (typeof execErr.code === "number") return new Set();
		throw err;
	}
	const set = new Set<string>();
	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		set.add(validateGitHash(trimmed));
	}
	return set;
}
