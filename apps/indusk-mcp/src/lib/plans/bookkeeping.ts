import { git } from "../git.js";
import type { PlanBranch } from "./plan-branch.js";

/**
 * InDusk's own bookkeeping on the trunk (admin-plan-authoring, Build Phase
 * 10). The evaluator, the highlight tool and the session sections write these
 * files into the trunk's working tree and nothing commits them, so they sit
 * uncommitted and collide with a plan's merge. They are InDusk's, not the
 * person's: approving and landing commit them, in a commit of their own, and
 * go on. Anything else uncommitted on the trunk may be someone's real work —
 * it is shown at review and stops the merge, never settled by a session.
 *
 * Where this bookkeeping should be written at all is the follow-on brief's
 * question (`bookkeeping-lives-where-it-is-read`).
 */

const BOOKKEEPING_FILES = [
	".indusk/current.md",
	".indusk/highlights.jsonl",
	".indusk/highlights-processed.jsonl",
];
const BOOKKEEPING_DIRS = [".indusk/eval/", ".claude/lessons/"];

export function isBookkeeping(path: string): boolean {
	return BOOKKEEPING_FILES.includes(path) || BOOKKEEPING_DIRS.some((dir) => path.startsWith(dir));
}

/** The paths `git status --porcelain` reports, however its first line was trimmed. */
export function statusPaths(porcelain: string): string[] {
	return porcelain
		.split("\n")
		.filter(Boolean)
		.map((l) => l.replace(/^\s*\S{1,2}\s+/, ""));
}

/** Commit the trunk's uncommitted bookkeeping, if any; returns the paths committed. */
export async function commitTrunkBookkeeping(pb: PlanBranch, why: string): Promise<string[]> {
	const paths = statusPaths(
		await git(pb.trunk, "status", "--porcelain", "--untracked-files=all"),
	).filter(isBookkeeping);
	if (paths.length === 0) return [];
	await git(pb.trunk, "add", "--", ...paths);
	await git(
		pb.trunk,
		"commit",
		"-q",
		"-m",
		`chore(indusk): bookkeeping, committed ${why}`,
		"--",
		...paths,
	);
	return paths;
}

/** Uncommitted changes on the trunk, outside InDusk's bookkeeping, on any of `paths`. */
export async function uncommittedWork(trunk: string, paths: string[]): Promise<string[]> {
	if (paths.length === 0) return [];
	return statusPaths(
		await git(trunk, "status", "--porcelain", "--untracked-files=all", "--", ...paths),
	).filter((p) => !isBookkeeping(p));
}
