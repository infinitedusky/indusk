import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * The git surface `atdawn verify` reads through.
 *
 * Verify is a detector over committed state, so git IS its input device. Every
 * call here is read-only by construction — there is no write helper in this
 * module and there must never be one, because "detect, never repair" is the
 * component's scope decision and this is where a violation would have to live.
 */

const execFileAsync = promisify(execFile);

export async function git(root: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
	return stdout.trim();
}

/**
 * Assert the root is inside a git work tree, failing LOUD when it is not.
 *
 * A workbench root is deliberately not a git repo, and the cleanup library's
 * silent-`[]` on that shape made its ritual vacuous there. The same silence in
 * a verifier would report "clean" for a phase it never examined — the worst
 * shape a verification bug can take.
 */
export async function assertGitRepo(root: string): Promise<void> {
	try {
		await git(root, "rev-parse", "--is-inside-work-tree");
	} catch {
		throw new Error(
			`${root} is not a git repository — verify reconstructs the phase boundary from committed history and cannot run without one. (Refusing rather than reporting a clean phase.)`,
		);
	}
}

export async function headSha(root: string): Promise<string> {
	return git(root, "rev-parse", "HEAD");
}

/** Candidate trunk refs, in the order `cleanup/oversized.ts` proved necessary. */
const TRUNK_CANDIDATES = ["origin/main", "main", "origin/master", "master"] as const;

/**
 * The bootstrap baseline for a plan with no ledger record yet: the merge base
 * with the trunk.
 *
 * The candidate chain exists because `origin/main` alone silently yields an
 * empty diff against an unfetched remote — a wrong answer that looks like a
 * right one. Falls back to the repo's root commit so a branch with no common
 * ancestor still gets a real baseline instead of an exception.
 */
export async function resolveMergeBase(root: string, baseRef?: string): Promise<string> {
	for (const candidate of [baseRef, ...TRUNK_CANDIDATES].filter(Boolean) as string[]) {
		try {
			const base = await git(root, "merge-base", candidate, "HEAD");
			if (base) return base;
		} catch {
			// Ref absent in this clone — try the next candidate.
		}
	}
	const roots = await git(root, "rev-list", "--max-parents=0", "HEAD");
	const first = roots.split("\n")[0]?.trim();
	if (!first) {
		throw new Error(
			`Could not resolve a baseline commit in ${root} — no trunk ref matched and the repository has no root commit.`,
		);
	}
	return first;
}

/** File contents at a commit, or null when the path did not exist there. */
export async function showFileAt(
	root: string,
	sha: string,
	repoRelPath: string,
): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync("git", ["show", `${sha}:${repoRelPath}`], {
			cwd: root,
			maxBuffer: 32 * 1024 * 1024,
		});
		return stdout;
	} catch {
		return null;
	}
}

/** Repo-relative paths that changed between a commit and the working tree. */
export async function changedPathsSince(root: string, sha: string): Promise<string[]> {
	const tracked = await git(root, "diff", "--name-only", sha, "HEAD");
	const uncommitted = await git(root, "diff", "--name-only", "HEAD");
	return [...new Set([...tracked.split("\n"), ...uncommitted.split("\n")])]
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}
