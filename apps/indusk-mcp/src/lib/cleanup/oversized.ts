import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCleanupConfig, resolveCapForPath } from "../config.js";

/** A changed file whose line count exceeds its resolved cleanup cap. */
export interface OversizedFile {
	/** Repo-relative path. */
	path: string;
	/** Line count at HEAD/working tree. */
	loc: number;
	/** The cap that applied (scope override or global default). */
	cap: number;
	/** The matching scope's `include` glob, or undefined for the global default. */
	scope?: string;
	/** True when the file did not exist at the merge base (a new file). */
	isNew: boolean;
}

/** Run git; swallow errors to an empty string (callers tolerate absence). */
function git(projectRoot: string, args: string[]): string {
	try {
		return execFileSync("git", args, { cwd: projectRoot, encoding: "utf-8" }).trim();
	} catch {
		return "";
	}
}

/** True iff `<ref>:<rel>` resolves — used to tell new files from modified. */
function fileExistsAtRef(projectRoot: string, ref: string, rel: string): boolean {
	try {
		execFileSync("git", ["cat-file", "-e", `${ref}:${rel}`], { cwd: projectRoot, stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/** Count lines, ignoring a single trailing newline. */
function countLoc(content: string): number {
	if (content === "") return 0;
	const lines = content.split("\n");
	if (lines[lines.length - 1] === "") lines.pop();
	return lines.length;
}

// Generated / vendored files are never decomposition targets — no one splits a
// lockfile, a log, or a bundled dist file. Excluded before the cap check so the
// ritual's output is signal, not noise. (Surfaced by the cleanup-ritual dogfood,
// which flagged pnpm-lock.yaml at 7.7k LOC and the semantic-graph log at 25k.)
const EXCLUDE_DIRS = new Set(["node_modules", "dist", "build", ".next", "coverage", ".turbo"]);
const EXCLUDE_BASENAMES = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);

function isGeneratedOrVendored(rel: string): boolean {
	const parts = rel.split("/");
	const base = parts[parts.length - 1];
	if (EXCLUDE_BASENAMES.has(base)) return true;
	if (base.endsWith(".lock") || base.endsWith(".log")) return true;
	if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
	if (rel.startsWith(".indusk/graph/")) return true;
	return false;
}

/**
 * List the changed files (vs the merge base with `baseRef`) whose line count
 * exceeds their resolved cleanup cap. This is what the `/cleanup` ritual
 * scrutinizes at plan close — **the cap is attention-focus, never a blocking
 * gate.**
 *
 * Changed-file computation mirrors the worktree preflight: the sorted union of
 * committed (`<mergeBase>..HEAD`), staged (`--cached`), and unstaged diffs,
 * filtered to files that still exist on disk. `baseRef` defaults to
 * `origin/main`; when merge-base resolution fails (shallow clone, unrelated
 * history) it falls back to `baseRef` directly.
 */
export function listOversizedChangedFiles(
	projectRoot: string,
	baseRef = "origin/main",
): OversizedFile[] {
	const mergeBase = git(projectRoot, ["merge-base", baseRef, "HEAD"]) || baseRef;

	const names = new Set<string>();
	const ranges: string[][] = [[`${mergeBase}..HEAD`], ["--cached"], []];
	for (const range of ranges) {
		const out = git(projectRoot, ["diff", "--name-only", ...range]);
		for (const line of out.split("\n")) {
			const f = line.trim();
			if (f) names.add(f);
		}
	}

	const cfg = getCleanupConfig(projectRoot);
	const result: OversizedFile[] = [];
	for (const rel of [...names].sort()) {
		const abs = join(projectRoot, rel);
		if (!existsSync(abs)) continue; // deleted or renamed away
		if (isGeneratedOrVendored(rel)) continue; // lockfiles, logs, dist — never decomposition targets
		const loc = countLoc(readFileSync(abs, "utf-8"));
		const { cap, scope } = resolveCapForPath(rel, cfg);
		if (loc > cap) {
			result.push({
				path: rel,
				loc,
				cap,
				scope,
				isNew: !fileExistsAtRef(projectRoot, mergeBase, rel),
			});
		}
	}
	return result;
}
