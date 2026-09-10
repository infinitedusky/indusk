import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

/**
 * The git primitives more than one subsystem needs.
 *
 * Deliberately *not* inside `verify/` or `shape/`: both of those are domain
 * modules with their own vocabulary (verify's `assertGitRepo` refuses in
 * verify's words; shape's scoping answers shape's question), and a primitive
 * that lives in one domain's folder gets copied by the next domain rather than
 * imported. That is exactly what happened here — `shape/changed.ts` carried a
 * byte-identical copy of verify's runner, down to the maxBuffer.
 */

const execFileAsync = promisify(execFile);

/** Run git in `root` and return trimmed stdout. Throws on non-zero exit. */
export async function git(root: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
	return stdout.trim();
}

export interface ChangedPaths {
	/** Committed since `sha`, plus anything modified in the working tree. */
	tracked: string[];
	/** Present on disk and unknown to git. */
	untracked: string[];
}

/**
 * What changed since `sha`, keeping tracked and untracked apart.
 *
 * The untracked half is not a nicety. `git diff` reports tracked modifications
 * only, so an agent that writes real code without `git add`ing it produced a
 * diff containing nothing but the plan file — and looked, to phantom detection,
 * exactly like an agent that wrote nothing at all. Half-in/half-out on the
 * working tree is the bug; either stance is defensible, the mixture is not.
 *
 * Partitioned rather than unioned because the two halves carry different
 * evidence about *when* they happened. Committed work is placed in time by its
 * commit; untracked work has only its mtime, which is the only way to tell a
 * scratch file left by an earlier phase from this phase's real work. Callers
 * that do not care can union the two — `changedPathsSince` does exactly that.
 */
export async function changedPathsPartitioned(root: string, sha: string): Promise<ChangedPaths> {
	const committed = await git(root, "diff", "--name-only", sha, "HEAD");
	const unstaged = await git(root, "diff", "--name-only", "HEAD");
	const untracked = await git(root, "ls-files", "--others", "--exclude-standard");

	const clean = (raw: string): string[] =>
		raw
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

	return {
		tracked: [...new Set([...clean(committed), ...clean(unstaged)])],
		untracked: clean(untracked),
	};
}

/**
 * A working-tree snapshot: each path's content before a step touched it, or
 * null when it did not exist. Taken before a multi-file write so a failure
 * part-way can put the tree back exactly.
 */
export type PathSnapshot = Map<string, string | null>;

export function snapshotPaths(root: string, rels: string[]): PathSnapshot {
	const taken: PathSnapshot = new Map();
	for (const rel of rels) {
		const path = join(root, rel);
		taken.set(rel, existsSync(path) ? readFileSync(path, "utf-8") : null);
	}
	return taken;
}

/**
 * Put the tree back to a snapshot: unstage every path, then rewrite each
 * to its prior content or remove it. A path that was a staged rename's new
 * name is removed and its old name rewritten, because both were in the
 * snapshot. Lifted out of `papers/publish.ts` (writing-skill cleanup) on the
 * rule that a git primitive kept in a domain folder gets copied by the next.
 */
export async function restorePaths(root: string, taken: PathSnapshot): Promise<void> {
	try {
		await git(root, "reset", "-q", "--", ...taken.keys());
	} catch {
		// Nothing was staged, or a path was never tracked. The rewrite below is what matters.
	}
	for (const [rel, previous] of taken) {
		const path = join(root, rel);
		if (previous === null) {
			rmSync(path, { force: true });
		} else {
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, previous);
		}
	}
}
