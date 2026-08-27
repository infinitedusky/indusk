/**
 * Stray-state audit for workbench-shaped InDusk projects (1.31.7).
 *
 * Workbench mode means `.indusk/` lives at the workbench root, shared across
 * all worktrees. Stray `.indusk/` directories inside the wrapped repo are an
 * artifact of pre-1.31.7 `indusk init` runs that didn't know about workbench
 * mode, OR of operators running `indusk init` from inside the wrapped repo.
 *
 * They silently confuse path resolution. This audit detects them so an
 * operator can manually `rm -rf` after confirming nothing important is in them.
 *
 * Workbench mode is detected by reading `.indusk/config.json` at the
 * `workbenchRoot` and resolving its declared repo set via `readWorkbenchRepos`
 * (which reduces the legacy `wrapped_repo` into a one-element list). Single-
 * repo mode skips the audit entirely (no false positives).
 *
 * Worktrees that live at the workbench-root level (sibling to the wrapped
 * repo) may legitimately have their own `.indusk/` for per-worktree scratch
 * and are NOT flagged as stray. Only `.indusk/` inside the explicit wrapped
 * repo path is flagged.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readWorkbenchRepos } from "./worktree/repos.js";

export interface StrayStateFinding {
	/** Absolute path to the stray `.indusk/` directory. */
	path: string;
	/** Why it's flagged. v1 has one type. */
	type: "wrapped-repo-stray";
	/** A recommended cleanup command the operator can run after confirming
	 * nothing important is in the directory. */
	recommendation: string;
}

/**
 * Find stray `.indusk/` directories in a workbench-shaped project.
 *
 * Returns an empty array if:
 * - `workbenchRoot` is not a workbench-mode project (no declared repos
 *   in config) — single-repo projects are not audited
 * - the wrapped repo doesn't exist (nothing to audit)
 * - no stray state is found (clean workbench)
 *
 * Currently flags only one shape: a `.indusk/` directory inside the explicit
 * wrapped repo subdirectory. Worktrees at the workbench-root level (siblings
 * to the wrapped repo) are permitted to have their own `.indusk/` for scratch.
 */
export function findStrayState(workbenchRoot: string): StrayStateFinding[] {
	// Every declared repo is audited, not just the first. A workbench that
	// wraps N repos can accumulate stray state in any of them, and auditing
	// only one produces a clean report about a dirty workbench.
	const repos = readWorkbenchRepos(workbenchRoot);

	// Not a workbench project — skip audit.
	if (repos.length === 0) return [];

	const findings: StrayStateFinding[] = [];

	for (const repo of repos) {
		const wrappedRepoPath = join(workbenchRoot, repo.name);
		if (!existsSync(wrappedRepoPath)) continue;
		const strayInsideWrapped = walkForStrayIndusk(wrappedRepoPath, 2);
		for (const strayPath of strayInsideWrapped) {
			findings.push({
				path: strayPath,
				type: "wrapped-repo-stray",
				recommendation: `rm -rf "${strayPath}"`,
			});
		}
	}

	return findings;
}

/**
 * Walk down from `dir` looking for `.indusk/` directories, up to `maxDepth`
 * levels deep. Returns absolute paths. Skips `node_modules/`, `.git/`, and
 * other common large/uninteresting directories for performance.
 */
function walkForStrayIndusk(dir: string, maxDepth: number): string[] {
	const found: string[] = [];

	function walk(current: string, depth: number): void {
		if (depth > maxDepth) return;

		// Check for `.indusk/` at this level
		const induskPath = join(current, ".indusk");
		if (existsSync(induskPath)) {
			found.push(induskPath);
			// Don't recurse into a stray .indusk/ (no value, just bloat)
		}

		// Recurse into subdirectories
		if (depth === maxDepth) return;
		let entries: { name: string; isDirectory: () => boolean }[] = [];
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (
				entry.name === "node_modules" ||
				entry.name === ".git" ||
				entry.name === ".next" ||
				entry.name === "dist" ||
				entry.name === "build" ||
				entry.name === ".indusk"
			) {
				continue;
			}
			walk(join(current, entry.name), depth + 1);
		}
	}

	walk(dir, 0);
	return found;
}
