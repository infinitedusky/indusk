import { existsSync } from "node:fs";
import { join } from "node:path";
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
// Incidents are written unprompted by the recorder (incident-recording, ADR
// D3): InDusk's, like the lessons, and committed rather than left behind.
const BOOKKEEPING_DIRS = [".indusk/eval/", ".claude/lessons/", ".indusk/promises/incidents/"];

export function isBookkeeping(path: string): boolean {
	return BOOKKEEPING_FILES.includes(path) || BOOKKEEPING_DIRS.some((dir) => path.startsWith(dir));
}

/**
 * Every path with an uncommitted change in `checkout`, limited to `paths`
 * when given — both sides of a rename or copy, each as itself (A37). Read
 * with `-z`, where a rename is `R  new\0old\0`: read line by line, it is
 * one string, `old -> new`, that names no file.
 */
export async function statusPaths(checkout: string, paths?: string[]): Promise<string[]> {
	const out = await git(
		checkout,
		"status",
		"--porcelain",
		"-z",
		"--untracked-files=all",
		...(paths ? ["--", ...paths] : []),
	);
	const fields = out.split("\0");
	const found: string[] = [];
	for (let i = 0; i < fields.length; i++) {
		const entry = fields[i];
		if (!entry) continue;
		// `git()` trims its output, so the first entry may have lost the space
		// that leads an unstaged status (` M path` arrives as `M path`).
		const status = entry[2] === " " ? entry.slice(0, 2) : entry.slice(0, 1);
		found.push(entry.slice(status.length + 1));
		if (/[RC]/.test(status)) found.push(fields[++i]);
	}
	return found;
}

/** Commit the trunk's uncommitted bookkeeping, if any; returns the paths committed. */
export async function commitTrunkBookkeeping(pb: PlanBranch, why: string): Promise<string[]> {
	const paths = (await statusPaths(pb.trunk)).filter(isBookkeeping);
	if (paths.length === 0) return [];
	// A path gone from disk (a deletion, a rename's old side) cannot be
	// `git add`ed once the index has dropped it too; the commit below takes
	// it by name, from HEAD. Only what is on disk needs adding.
	const onDisk = paths.filter((p) => existsSync(join(pb.trunk, p)));
	if (onDisk.length > 0) await git(pb.trunk, "add", "--", ...onDisk);
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
	return (await statusPaths(trunk, paths)).filter((p) => !isBookkeeping(p));
}
