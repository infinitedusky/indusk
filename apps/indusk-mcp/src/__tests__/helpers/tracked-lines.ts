import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { git, REPO_ROOT } from "./cli.js";

export interface Hit {
	file: string;
	line: number;
	text: string;
}

/**
 * Every line of every tracked text file in the repository that matches `needle`,
 * minus the paths `skip` names. A whole-repository "this wording is gone" check
 * greps the tracked tree, never a list of files someone remembered (lesson:
 * a-plan-that-retires-wording-greps-the-whole-repo-for-it-and-carries-a-grep-is-gone-row).
 *
 * A tracked file that is no longer on disk, a binary file and a file over 2 MB are
 * not text to search.
 */
export function trackedLinesMatching(
	needle: string | RegExp,
	skip: (relPath: string) => boolean,
): Hit[] {
	const listed = git(REPO_ROOT, ["ls-files", "-z"]);
	if (listed.code !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
	const hits: Hit[] = [];
	for (const rel of listed.stdout.split("\0").filter(Boolean)) {
		if (skip(rel)) continue;
		const abs = join(REPO_ROOT, rel);
		if (!existsSync(abs) || statSync(abs).size > 2_000_000) continue;
		const text = readFileSync(abs, "utf-8");
		if (text.includes("\0")) continue;
		text.split("\n").forEach((line, i) => {
			const found = typeof needle === "string" ? line.includes(needle) : needle.test(line);
			if (found) hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
		});
	}
	return hits;
}

/** `file:line  text`, one per hit, for an assertion message. */
export const describeHits = (hits: Hit[]): string[] =>
	hits.map((h) => `${h.file}:${h.line}  ${h.text}`);
