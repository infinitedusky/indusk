import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkbenchRepo, WorktreeConfig } from "../config.js";
import { isCleanSegment, isUsableRelPath, isUsableSegment } from "../path-segment.js";

export type { WorkbenchRepo } from "../config.js";

/**
 * The one definition of "which repos is this workbench made of".
 *
 * Every consumer — `worktree list`, `init`, the stray-state audit, the eval
 * hook's git-path fallback, `workbench restore`, and the bash scripts through
 * their own shared helper — resolves the repo set here. Two lanes reading it
 * independently will disagree, and in the bash lane the disagreement is silent
 * because nothing type-checks it. Pinned by a single-definition test.
 *
 * Deliberately NOT a general config reader: it answers one question, so a
 * caller cannot accidentally depend on a neighbouring field and make this
 * module the place where unrelated config knowledge accumulates.
 */

interface RawConfig {
	worktree?: WorktreeConfig & { repos?: unknown };
}

function readRawConfig(root: string): RawConfig | null {
	const configPath = join(root, ".indusk", "config.json");
	if (!existsSync(configPath)) return null;
	try {
		return JSON.parse(readFileSync(configPath, "utf-8")) as RawConfig;
	} catch {
		return null;
	}
}

/**
 * Read the declared repo set, newest shape first, singular reduced into it.
 *
 * **The reduction IS the backward-compatibility guarantee**, not a claim about
 * one: `wrapped_repo: "numero"` reads as `[{ name: "numero" }]`, so every
 * workbench written before this plan keeps working with no config edit and no
 * migration step. The same shape as `phaseOrdinal` reducing to the phase
 * number when a document has no test phase.
 *
 * Names are boundary values — sanitized before any caller can join them into a
 * path, and first-occurrence-deduped so declared order survives. A malformed
 * declaration degrades to fewer repos, never to a traversal.
 *
 * Returns `[]` for a project that declares nothing, which callers read as
 * "not a workbench" exactly as they read a missing `wrapped_repo` today.
 */
export function readWorkbenchRepos(root: string): WorkbenchRepo[] {
	const worktree = readRawConfig(root)?.worktree;
	if (!worktree) return [];

	const declared = Array.isArray(worktree.repos)
		? worktree.repos
		: typeof worktree.wrapped_repo === "string"
			? [{ name: worktree.wrapped_repo }]
			: [];

	const seen = new Set<string>();
	const repos: WorkbenchRepo[] = [];
	for (const entry of declared) {
		if (typeof entry !== "object" || entry === null) continue;
		const { name, remote } = entry as { name?: unknown; remote?: unknown };
		if (typeof name !== "string" || !isCleanSegment(name)) continue;
		if (seen.has(name)) continue;
		seen.add(name);

		// `path` and `worktrees` are joined into filesystem paths, so they are
		// boundary values exactly as `name` is. A declared value that is not a
		// clean segment is DROPPED, degrading to the default rather than
		// resolving to a traversal.
		const { path, worktrees } = entry as { path?: unknown; worktrees?: unknown };
		const repo: WorkbenchRepo = { name };
		if (typeof remote === "string" && remote.trim() !== "") repo.remote = remote;
		if (typeof path === "string" && isUsableRelPath(path)) repo.path = path;
		if (typeof worktrees === "string" && isUsableRelPath(worktrees)) repo.worktrees = worktrees;
		repos.push(repo);
	}
	return repos;
}

/** Whether this project is workbench-shaped at all. */
export function isWorkbench(root: string): boolean {
	return readRawConfig(root)?.worktree?.shape === "workbench";
}

/** The parent directory the sibling clones live in, or null when undeclared. */
export function readSiblingParent(root: string): string | null {
	const value = readRawConfig(root)?.worktree?.sibling_parent;
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Where this workbench's repos live.
 *
 * `repos_root` supersedes `sibling_parent`, which named a *relationship*
 * ("the parent of the siblings") rather than the value. The relationship stops
 * being true the moment the repos live inside the workbench, and a field that
 * describes a layout it no longer governs is worse than a bland one.
 *
 * The old key is still read, so no existing workbench needs an edit — the same
 * reduction `wrapped_repo` gets. Returns the declared string verbatim;
 * resolving it (relative to the workbench, or absolute) belongs to the caller
 * that knows where the workbench is.
 */
export function readReposRoot(root: string): string | undefined {
	const w = readRawConfig(root)?.worktree;
	for (const value of [w?.repos_root, w?.sibling_parent]) {
		if (typeof value === "string" && value.trim() !== "") return value;
	}
	return undefined;
}

/**
 * The refusal a command owes a project that is not a workbench.
 *
 * One string, because the *rule* it belongs to lives in bash. `worktree
 * create`/`refresh`/`preflight` all resolve which repo the user meant inside
 * `_resolve_workbench_repo`, and `worktreeCreate` deliberately passes `--repo`
 * straight through rather than deciding first — so there is exactly one
 * implementation of pick-one and it is the shell one.
 *
 * A TypeScript `resolveRepo` stood here with no caller, its docblock claiming
 * to be "the rule the CLI surface needs in one place" while the CLI surface
 * read the shell. Dead code that describes itself as authoritative is worse
 * than dead code; what the TS lane actually shares with bash is this message.
 */
export const NOT_A_WORKBENCH =
	'this project is not a workbench (set worktree.shape="workbench" and worktree.repos[] in .indusk/config.json, or run `indusk init --workbench`).';

/**
 * Where this repo's checkout lives, relative to the workbench root.
 *
 * The declared `path`, or the name when nothing is declared. One function so
 * no caller re-derives it — a second copy would be the place the two answers
 * quietly diverge.
 */
export function repoDir(repo: WorkbenchRepo): string {
	return repo.path ?? repo.name;
}
