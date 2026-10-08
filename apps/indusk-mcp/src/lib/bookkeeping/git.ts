import { spawnSync } from "node:child_process";

export interface GitResult {
	code: number;
	out: string;
	err: string;
}

/**
 * Run git in `cwd` and return what it said, never throwing: the bookkeeping
 * writers decide from the exit code whether a note was committed, a file
 * tracked or a worktree listed. Synchronous, since they run inside a file lock.
 */
export function gitSync(cwd: string, ...args: string[]): GitResult {
	const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
	return { code: r.status ?? -1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
