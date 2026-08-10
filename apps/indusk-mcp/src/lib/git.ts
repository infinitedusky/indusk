import { execFile } from "node:child_process";
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
