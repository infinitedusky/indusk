/**
 * Worktree-visibility Phase 2 — the deterministic core behind the skill-driven
 * kickoff step. Two pure helpers:
 *
 *   resolveWorktreeDecision(implContent) — should this plan get a worktree?
 *     Reads the `worktree:` impl frontmatter key. `none` → "skip"; absent or
 *     any other value → "create". This is the whole opt-out mechanism: no
 *     workflow ships `worktree: none` by default, so the default is always
 *     "create".
 *
 *   detectTreeContext(cwd) — is this cwd in the trunk or a linked worktree?
 *     Compares the current toplevel against the repo's main worktree (the first
 *     entry of `git worktree list`). The git runner is injectable for tests.
 */

import { spawnSync } from "node:child_process";
import matter from "gray-matter";

export type WorktreeDecision = "create" | "skip";

/**
 * Decide whether a plan's impl kickoff should create a worktree. Pure — reads
 * only the `worktree:` frontmatter key. Unparseable content → "create" (the
 * safe default: a plan with a broken header still gets isolation).
 */
export function resolveWorktreeDecision(implContent: string): WorktreeDecision {
	try {
		const { data } = matter(implContent);
		const raw = data.worktree;
		if (typeof raw !== "string") return "create";
		if (raw.trim().toLowerCase() === "none") return "skip";
		return "create";
	} catch {
		return "create";
	}
}

export type TreeKind = "trunk" | "worktree";

export interface TreeContext {
	/** "trunk" = the repo's main working tree; "worktree" = a linked worktree. */
	kind: TreeKind;
	/** The current git toplevel path, or "" when cwd is not in a git repo. */
	toplevel: string;
}

/** stdout of a git invocation, or null on non-zero exit / spawn failure. */
export type GitRunner = (args: string[], cwd: string) => string | null;

const defaultGitRunner: GitRunner = (args, cwd) => {
	const res = spawnSync("git", args, { cwd, encoding: "utf-8" });
	if (res.status !== 0) return null;
	return res.stdout ?? null;
};

/** First `worktree <path>` line of `git worktree list --porcelain` = the main tree. */
function parseMainWorktree(porcelain: string): string {
	for (const line of porcelain.split("\n")) {
		const m = line.match(/^worktree\s+(.+)$/);
		if (m) return m[1].trim();
	}
	return "";
}

/**
 * Classify a cwd as trunk vs. linked worktree. Not in a git repo → trunk with
 * empty toplevel (the safe default that would trigger the kickoff nudge).
 */
export function detectTreeContext(cwd: string, run: GitRunner = defaultGitRunner): TreeContext {
	const toplevelRaw = run(["rev-parse", "--show-toplevel"], cwd);
	if (!toplevelRaw) return { kind: "trunk", toplevel: "" };
	const toplevel = toplevelRaw.trim();

	const listRaw = run(["worktree", "list", "--porcelain"], cwd);
	const mainTree = listRaw ? parseMainWorktree(listRaw) : "";
	// If we can't determine the main tree, fall back to trunk (don't false-flag a nudge).
	const kind: TreeKind = !mainTree || mainTree === toplevel ? "trunk" : "worktree";
	return { kind, toplevel };
}
