/**
 * Workbench-aware path resolver for InDusk hooks (shipped 1.31.7).
 *
 * The 4 hooks (eval-trigger, check-catchup, check-gates, validate-impl-structure)
 * each used to carry their own copy of `findProjectRoot()` that walked up looking
 * for `.indusk/`. In workbench-shaped projects that landed at the workbench root
 * — which is NOT a git repo. Hooks that then tried `git rev-parse` against that
 * path silently bailed. The eval pipeline never fired on numero_workbench for
 * 2 months. See `.indusk/planning/workbench-mode-rail-integrity/`.
 *
 * The fix: hooks need TWO paths, not one.
 *
 *   statePath: where `.indusk/` lives. Walk up from cwd to find it. In workbench
 *     mode this is the workbench root. In single-repo mode it's the project root.
 *     Used for: highlights queue, config.json, settings.json registration,
 *     system.log, results.log, evaluator-runner discovery.
 *
 *   gitPath: where the git repo lives. Derived via `git rev-parse --show-toplevel`
 *     against cwd. In workbench mode this is the wrapped repo (or a worktree).
 *     In single-repo mode it's the project root (== statePath).
 *     Used for: git operations — `git rev-parse --short HEAD`, change ID
 *     extraction, anything that needs to know the actual git tree.
 *
 * ESM-native. No CJS `require()` — per the eval-agent-bug-fix lesson (1.19.1).
 * Both paths are realpath-normalized so consumers can rely on string equality.
 */

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Walk up from `startDir` looking for a directory containing `.indusk/`. Returns
 * the realpath of the first match, or null if no match before filesystem root.
 *
 * @param {string} startDir
 * @returns {string | null}
 */
function findStatePath(startDir) {
	let current = resolve(startDir);
	// Hard cap to defend against pathological symlink loops. 40 ancestors is
	// vastly more than any real filesystem path.
	for (let i = 0; i < 40; i++) {
		if (existsSync(resolve(current, ".indusk"))) {
			try {
				return realpathSync(current);
			} catch {
				return current;
			}
		}
		const parent = dirname(current);
		if (parent === current) return null; // filesystem root
		current = parent;
	}
	return null;
}

/**
 * Returns the absolute path to the git repo root for `cwd`, derived via
 * `git rev-parse --show-toplevel`. In a worktree this returns the worktree's
 * own path (not the canonical clone). Returns null if cwd is not in any git
 * repo or if git is missing.
 *
 * @param {string} cwd
 * @returns {string | null}
 */
function findGitPath(cwd) {
	try {
		const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		const raw = out.trim();
		if (!raw) return null;
		try {
			return realpathSync(raw);
		} catch {
			return raw;
		}
	} catch {
		// Not in a git repo, git not on PATH, or some other failure.
		// The caller decides how to handle.
		return null;
	}
}

/**
 * Resolve both the InDusk state path and the git path for a given cwd. Either
 * may be null:
 *   - `statePath` is null if no `.indusk/` directory exists in any ancestor.
 *   - `gitPath` is null if `cwd` is not inside any git repo.
 *
 * The two paths may be the SAME (single-repo mode) or DIFFERENT (workbench mode).
 * Callers must use the right path for the right operation:
 *   - File operations against `.indusk/...` → use `statePath`
 *   - Git operations (`git rev-parse --short HEAD`, etc.) → use `gitPath`
 *
 * @param {string} cwd
 * @returns {{ statePath: string | null, gitPath: string | null }}
 */
export function resolveStateAndGitPaths(cwd) {
	return {
		statePath: findStatePath(cwd),
		gitPath: findGitPath(cwd),
	};
}
