#!/usr/bin/env node
/**
 * PreToolUse hook: no code on trunk (trunk-guard plan).
 *
 * Worktree-per-plan is the default and every close-out lands by merge, but
 * nothing stopped an agent from editing code straight on `main` when the
 * change felt small — on 2026-09-17 one session committed a skill step, a
 * guard fix, a feature and another session's WIP to `main` in one afternoon.
 * The release guard refuses an unmerged packaged BRANCH; this hook refuses
 * the packaged edit made on trunk in the first place.
 *
 * Two matchers, one rule:
 *
 *   - Edit / Write / MultiEdit: the file's repository is on a protected
 *     branch and the file is not allow-listed → BLOCK (exit 2).
 *   - Bash `git commit`: the repository is on a protected branch and any
 *     staged path is not allow-listed → BLOCK. This is what catches an edit
 *     made through `sed`, `python` or a heredoc, which the Edit gate never
 *     sees.
 *
 * Allowed on trunk — the writes a plan makes before it has a worktree (its
 * brief) or after it landed (compaction, the landing note), and what the eval
 * agent writes: `.indusk/**`, `.claude/lessons/**`, `.claude/settings*.json`,
 * `CLAUDE.md`, `AGENTS.md`.
 *
 * Exempt: a commit whose message begins `chore(release):` — the one packaged
 * edit that belongs on trunk. Off switches, both deliberate and visible:
 * `worktree.trunk_guard.enabled: false` in `.indusk/config.json`;
 * `INDUSK_TRUNK_GUARD=off` in the environment for one call.
 *
 * In a versioned workbench the branch judged is the declared code
 * repository's; the workbench repository holds plan documents and is
 * allow-listed by path before any git call is made.
 *
 * Exit 0 = allow. Exit 2 = block (stderr reaches the agent).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { resolveStateAndGitPaths } from "./_hook-paths.js";

const DEFAULT_BRANCHES = ["main", "master"];
const ALLOWED_PREFIXES = [".indusk/", ".claude/lessons/"];
const ALLOWED_FILES = new Set(["CLAUDE.md", "AGENTS.md"]);
const ALLOWED_PATTERNS = [/^\.claude\/settings[^/]*\.json$/];
// `git commit` in command position — start of the command or after a separator —
// with the eval hook's right-edge lookahead. `echo git commit` and `git commitment`
// are not commits. Never String.includes.
const COMMIT_RE = /(?:^|[;&|(]|\n)\s*git commit(?=$|\s|;|&|\|)/;
const RELEASE_MESSAGE_RE = /(?:^|\s)(?:-m|--message(?:=|\s))\s*["']?chore\(release\):/;

if (process.env.INDUSK_TRUNK_GUARD === "off") process.exit(0);

let input = "";
for await (const chunk of process.stdin) input += chunk;
let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0); // never block on our own parse failure
}

const toolName = event.tool_name ?? "";
const toolInput = event.tool_input ?? {};
const eventCwd = event.cwd ?? process.cwd();

/** `{ kind: "edit", paths, anchor }` or `{ kind: "commit", command, anchor }`, or null when the tool is none of ours. */
function classify() {
	if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") {
		const filePath = toolInput.file_path;
		if (typeof filePath !== "string" || filePath === "") return null;
		const abs = real(isAbsolute(filePath) ? filePath : resolve(eventCwd, filePath));
		return { kind: "edit", paths: [abs], anchor: dirname(abs) };
	}
	if (toolName === "Bash") {
		const command = toolInput.command;
		if (typeof command !== "string" || !COMMIT_RE.test(command)) return null;
		return { kind: "commit", command, anchor: eventCwd };
	}
	return null;
}

const subject = classify();
if (!subject) process.exit(0);

let statePath = null;
let gitPath = null;
try {
	({ statePath, gitPath } = resolveStateAndGitPaths(subject.anchor));
} catch {
	process.exit(0); // cannot locate the project — not ours to judge
}

statePath = statePath ? real(statePath) : null;
gitPath = gitPath ? real(gitPath) : null;
const config = readTrunkGuardConfig(statePath);
if (config.enabled === false) process.exit(0);
if (!gitPath) process.exit(0); // no repository — nothing has a branch

const branch = currentBranch(gitPath);
if (branch === null || !config.branches.includes(branch)) process.exit(0);

if (subject.kind === "commit") {
	if (RELEASE_MESSAGE_RE.test(subject.command)) process.exit(0);
	subject.paths = stagedPaths(gitPath, subject.command).map((p) => real(resolve(gitPath, p)));
}

const offending = subject.paths.filter((p) => !isAllowed(p));
if (offending.length === 0) process.exit(0);

const shown = offending.map((p) => displayPath(p)).slice(0, 10);
process.stderr.write(
	[
		`trunk-guard: refusing to ${subject.kind === "commit" ? "commit" : "edit"} code on \`${branch}\`.`,
		"",
		...shown.map((p) => `  ${p}`),
		offending.length > shown.length ? `  … and ${offending.length - shown.length} more` : "",
		"",
		"Work happens on a plan branch and lands by merge (retrospective Step 10):",
		"  indusk worktree create <plan>   (or: git worktree add ../<repo>-worktrees/<plan> -b plan/<plan>)",
		"",
		"Allowed on trunk: .indusk/**, .claude/lessons/**, .claude/settings*.json, CLAUDE.md, AGENTS.md,",
		"and a commit whose message begins `chore(release):`.",
		"Deliberate overrides: INDUSK_TRUNK_GUARD=off for one call; worktree.trunk_guard.enabled: false in .indusk/config.json for the project.",
		"",
	]
		.filter((line) => line !== null)
		.join("\n"),
);
process.exit(2);

// ---------------------------------------------------------------------------

/**
 * The real path, so a file under `/var/folders/…` and a root reported as
 * `/private/var/folders/…` compare as the same tree. A path that does not
 * exist yet (a Write) resolves through its nearest existing ancestor.
 */
function real(p) {
	try {
		return realpathSync(p);
	} catch {
		const parent = dirname(p);
		if (parent === p) return p;
		return join(real(parent), basename(p));
	}
}

function readTrunkGuardConfig(root) {
	const defaults = { enabled: true, branches: DEFAULT_BRANCHES };
	if (!root) return defaults;
	const configPath = resolve(root, ".indusk", "config.json");
	if (!existsSync(configPath)) return defaults;
	try {
		const raw = JSON.parse(readFileSync(configPath, "utf-8"));
		const tg = raw?.worktree?.trunk_guard ?? {};
		return {
			enabled: tg.enabled !== false,
			branches:
				Array.isArray(tg.branches) && tg.branches.every((b) => typeof b === "string")
					? tg.branches
					: DEFAULT_BRANCHES,
		};
	} catch {
		return defaults; // a malformed config must not switch the guard off silently, nor crash it
	}
}

/** The checked-out branch, or null when detached (nothing to protect). */
function currentBranch(repo) {
	try {
		return execFileSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
			cwd: repo,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

/** What `git commit` would commit: the index, plus tracked modifications under `-a`/`--all`. */
function stagedPaths(repo, command) {
	const paths = new Set(gitLines(repo, ["diff", "--cached", "--name-only"]));
	if (/(?:^|\s)(?:-a|--all)(?=\s|$)/.test(command)) {
		for (const p of gitLines(repo, ["diff", "--name-only"])) paths.add(p);
	}
	return [...paths];
}

function gitLines(repo, args) {
	try {
		return execFileSync("git", args, {
			cwd: repo,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/** Allowed if, relative to the state root or the git root that contains it, the path is a planning/lessons/settings/context file. */
function isAllowed(absPath) {
	for (const root of [statePath, gitPath]) {
		if (!root) continue;
		const rel = relative(root, absPath).split("\\").join("/");
		if (rel.startsWith("..") || isAbsolute(rel)) continue;
		if (ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
		if (ALLOWED_FILES.has(rel)) return true;
		if (ALLOWED_PATTERNS.some((re) => re.test(rel))) return true;
	}
	// A file under neither root is not this project's code.
	return ![statePath, gitPath].some((root) => root && !relative(root, absPath).startsWith(".."));
}

function displayPath(absPath) {
	const root = gitPath ?? statePath;
	const rel = root ? relative(root, absPath) : absPath;
	return rel.startsWith("..") ? absPath : rel;
}
