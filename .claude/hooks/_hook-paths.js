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
		if (existsSync(resolve(current, ".indusk")) || existsSync(resolve(current, ".claude"))) {
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
 * The fallback reads `${statePath}/.indusk/config.json` for the declared repo
 * set — `worktree.repos[]`, with the legacy `worktree.wrapped_repo` reducing
 * to a one-element list. **Deliberate port of `lib/worktree/repos.ts`'s
 * reduction**: a hook cannot import TypeScript, so the rule lives in two
 * places and they must change together.
 *
 * With exactly ONE declared repo the behaviour is unchanged from 1.31.10.
 *
 * With MORE THAN ONE (versioned-workbench D6) the fallback is ambiguous, so it
 * does not guess: it returns null, and the caller can name every declared repo
 * via `declaredReposAt`. Picking the first would attribute a commit to the
 * wrong repo, and a wrong attribution is indistinguishable from a right one in
 * the eval record — a silent gap is recoverable, a confident wrong answer is
 * not.
 *
 * Trade-off accepted (single-repo case, unchanged): if the user committed in a
 * SIBLING WORKTREE rather than the wrapped repo, this resolves `gitPath` to the
 * wrapped repo, whose HEAD may not be the commit just made.
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
	const declared = declaredRepoNames(config);
	// Ambiguous: more than one repo could hold this commit. Refuse rather than
	// attribute it to whichever happens to be declared first.
	if (declared.length !== 1) return null;
	const candidate = resolve(statePath, declared[0]);
	if (!existsSync(candidate)) return null;
	try {
		return realpathSync(candidate);
	} catch {
		return candidate;
	}
}

/**
 * The declared repo names, singular reduced into plural.
 *
 * Deliberate port of `readWorkbenchRepos` in `src/lib/worktree/repos.ts` —
 * hooks are plain JS and cannot import the TS module. Change both together.
 * Name-only: the hook never needs remotes.
 *
 * @param {unknown} config
 * @returns {string[]}
 */
function declaredRepoNames(config) {
	const worktree = config && typeof config === "object" ? config.worktree : null;
	if (!worktree || typeof worktree !== "object") return [];
	const raw = Array.isArray(worktree.repos)
		? worktree.repos
		: typeof worktree.wrapped_repo === "string"
			? [{ name: worktree.wrapped_repo }]
			: [];
	const seen = new Set();
	const names = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const name = entry.name;
		if (typeof name !== "string") continue;
		const clean =
			name.trim() !== "" &&
			name !== "." &&
			name !== ".." &&
			!name.includes("/") &&
			!name.includes("\\");
		if (!clean || seen.has(name)) continue;
		seen.add(name);
		names.push(name);
	}
	return names;
}

/**
 * Every declared repo name at a workbench root, so a caller that refuses can
 * SAY what it could not choose between.
 *
 * @param {string | null} statePath
 * @returns {string[]}
 */
export function declaredReposAt(statePath) {
	if (!statePath) return [];
	const configPath = resolve(statePath, ".indusk/config.json");
	if (!existsSync(configPath)) return [];
	try {
		return declaredRepoNames(JSON.parse(readFileSync(configPath, "utf-8")));
	} catch {
		return [];
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
