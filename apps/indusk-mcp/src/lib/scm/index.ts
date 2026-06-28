/**
 * Git-only change-ID and ancestry helpers for the semantic graph (and any
 * other SCM-coupled surface). git-only as of 1.31.0 (git-only-substrate
 * Phase 4 — the SCM abstraction layer is gone; git is the only SCM).
 */

import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";

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
 * Return the short SHA at the current HEAD. Throws if the git operation
 * fails (no git repo, no commits yet, etc.) — callers in graceful-degrade
 * paths must handle.
 */
export async function getCurrentChangeId(projectRoot: string): Promise<string> {
	const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
		cwd: projectRoot,
	});
	return validateGitHash(stdout);
}

/**
 * Return the set of short SHAs reachable from the current HEAD — the tip
 * + all ancestors via `git log --format=%h HEAD`. Returns an empty set
 * when the repo has no commits yet (callers iterate this set; an empty
 * ancestor set is harmless).
 */
export async function getReachableChangeIds(projectRoot: string): Promise<Set<string>> {
	let stdout: string;
	try {
		const result = await execFileAsync("git", ["log", "--format=%h", "HEAD"], {
			cwd: projectRoot,
		});
		stdout = result.stdout;
	} catch (err) {
		const execErr = err as ExecFileException;
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
