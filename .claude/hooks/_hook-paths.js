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
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Walk up from `startDir` looking for the InDusk state path — a directory
 * containing either `.indusk/` or `.claude/`. Both markers count: `.indusk/`
 * is the canonical InDusk substrate; `.claude/` is the Claude Code project
 * config dir, present even on InDusk-less projects. Hooks like check-catchup
 * need to resolve to the latter on non-InDusk projects.
 *
 * In workbench mode, BOTH live at the workbench root — finding either gets
 * the correct path.
 *
 * Returns the realpath of the first match, or null if no match before
 * filesystem root.
 *
 * @param {string} startDir
 * @returns {string | null}
 */
function findStatePath(startDir) {
	let current = resolve(startDir);
	// Hard cap to defend against pathological symlink loops. 40 ancestors is
	// vastly more than any real filesystem path.
	for (let i = 0; i < 40; i++) {
		if (
			existsSync(resolve(current, ".indusk")) ||
			existsSync(resolve(current, ".claude"))
		) {
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
function findGitPathFromCwd(cwd) {
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
 * Workbench-mode gitPath fallback (1.31.10 falsification finding). When
 * `findGitPathFromCwd` returns null (cwd is not inside any git repo), check
 * whether `statePath` is a workbench root and, if so, derive gitPath from
 * the configured wrapped repo.
 *
 * This is the common case for hooks fired by Claude Code in workbench mode:
 * the session's `event.cwd` is the workbench root (where Claude Code was
 * launched), NOT the wrapped repo or a worktree. `event.cwd` is the session
 * cwd, not the subprocess cwd that ran `git commit` — so `git rev-parse`
 * against it fails even though the commit DID happen in a real git repo
 * inside the workbench.
 *
 * The fallback reads `${statePath}/.indusk/config.json` for the
 * `worktree.wrapped_repo` field. If present and the path exists, returns
 * the realpath of `${statePath}/${wrapped_repo}`. Otherwise returns null
 * (caller logs an actionable skip message naming `statePath`).
 *
 * Trade-off accepted: if the user committed in a SIBLING WORKTREE rather
 * than the wrapped repo, this resolves `gitPath` to the wrapped repo
 * (giving the eval agent the wrapped repo's HEAD, which may not be the
 * commit just made). That's a known incompleteness — Phase N+1 work
 * could read `tool_input.command` for a `cd <worktree>` prefix to
 * disambiguate. Until then, the wrapped-repo fallback is strictly better
 * than the pre-1.31.10 behavior of silently bailing every commit.
 *
 * @param {string | null} statePath
 * @returns {string | null}
 */
function findGitPathFromWorkbenchConfig(statePath) {
	if (!statePath) return null;
	const configPath = resolve(statePath, ".indusk/config.json");
	if (!existsSync(configPath)) return null;
	let config;
	try {
		config = JSON.parse(readFileSync(configPath, "utf-8"));
	} catch {
		return null;
	}
	const wrappedRepo = config?.worktree?.wrapped_repo;
	if (!wrappedRepo || typeof wrappedRepo !== "string") return null;
	const candidate = resolve(statePath, wrappedRepo);
	if (!existsSync(candidate)) return null;
	try {
		return realpathSync(candidate);
	} catch {
		return candidate;
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
	const statePath = findStatePath(cwd);
	let gitPath = findGitPathFromCwd(cwd);
	if (!gitPath) {
		// Workbench-mode fallback (1.31.10). When event.cwd is the workbench
		// root, `git rev-parse` against it fails because the workbench root
		// isn't a git repo — but the wrapped repo IS, and its path is
		// recoverable from the workbench's config. Without this fallback,
		// Claude Code's PostToolUse hook bails on every commit when launched
		// from the workbench root (the dominant operating model on Numero
		// and any future FDE engagement).
		gitPath = findGitPathFromWorkbenchConfig(statePath);
	}
	return { statePath, gitPath };
}
