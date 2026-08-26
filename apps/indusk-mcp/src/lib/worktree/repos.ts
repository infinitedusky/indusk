import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkbenchRepo, WorktreeConfig } from "../config.js";
import { isCleanSegment } from "../path-segment.js";

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
		if (typeof path === "string" && isCleanSegment(path)) repo.path = path;
		if (typeof worktrees === "string" && isCleanSegment(worktrees)) repo.worktrees = worktrees;
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
 * Resolve which declared repo a caller means.
 *
 * The rule the CLI surface needs in one place: naming a repo picks it, naming
 * nothing picks the only one when there is only one, and naming nothing with
 * several declared is a **refusal carrying the candidates** — never a silent
 * pick. Guessing here would put a worktree in the wrong repo, which looks
 * exactly like success until someone reads the branch.
 */
export function resolveRepo(
	repos: WorkbenchRepo[],
	requested?: string,
): { repo: WorkbenchRepo } | { error: string } {
	if (repos.length === 0) {
		return {
			error:
				'this project is not a workbench (set worktree.shape="workbench" and worktree.repos[] in .indusk/config.json, or run `indusk init --workbench`).',
		};
	}
	if (requested !== undefined) {
		const match = repos.find((r) => r.name === requested);
		return match
			? { repo: match }
			: {
					error: `no declared repo named "${requested}". This workbench declares: ${repos.map((r) => r.name).join(", ")}.`,
				};
	}
	if (repos.length === 1) return { repo: repos[0] };
	return {
		error: `this workbench declares more than one repo, so the repo must be named: ${repos.map((r) => r.name).join(", ")}.`,
	};
}

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

/**
 * Where this repo's worktrees go, relative to the workbench root.
 *
 * `"."` means the workbench root itself — today's flat layout, and what every
 * workbench that declares nothing gets.
 */
export function worktreesDir(repo: WorkbenchRepo): string {
	return repo.worktrees ?? ".";
}
