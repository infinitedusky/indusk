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
 *     path the commit would take is not allow-listed → BLOCK. This is what
 *     catches an edit made through `sed`, `python` or a heredoc, which the
 *     Edit gate never sees.
 *
 * What the commit gate reads (falsification, 2026-09-17 — each was a hole):
 *   - `git [-C <path>] [-c k=v] [--no-pager …] commit …` — git's own options
 *     between `git` and the verb; `-C` moves the judged repository.
 *   - `cd <path> && git commit …` — a `cd` earlier in the same command moves
 *     the judged repository; the event's cwd alone was the wrong answer.
 *   - `bash -c "git commit …"`, `sh -c '…'`, `$(git commit …)`, `` `…` `` —
 *     a commit inside a substitution or a `-c` string is a commit.
 *   - `-a` inside a flag cluster (`-am`) and explicit pathspecs
 *     (`git commit -m x src/a.ts`, `… -- src/a.ts`) — both commit files that
 *     were never staged, so they join the judged set.
 * Not read, by the brief: a script the agent invokes by name that commits
 * inside itself. The run loop's escape scan stays best-effort.
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
// `git [options] commit` in command position: the start of the command, after a
// separator, inside `$(…)`/backticks, or as the string handed to `-c` (bash, sh,
// zsh). Git's own pre-verb options are captured so `-C <path>` can move the
// judged repository. Right-edge lookahead: `git commitment` is not a commit.
// `echo "git commit"` and `--grep 'git commit'` are not in command position and
// stay unmatched. Never String.includes.
const GIT_OPTIONS =
	"(?:\\s+(?:-C\\s+\\S+|-c\\s+\\S+|--git-dir(?:=\\S+|\\s+\\S+)|--work-tree(?:=\\S+|\\s+\\S+)|--no-pager|--no-optional-locks|--paginate|-[pP]))*";
const COMMIT_RE = new RegExp(
	`(?:^|[;&|(\\n]|\\x60|(?:^|\\s)-c\\s+["'])\\s*git(${GIT_OPTIONS})\\s+commit(?=$|\\s|[;&|)"'\\x60])`,
);
// Options that take a value, so the value is never read as a pathspec.
const SHORT_WITH_VALUE = new Set(["m", "F", "C", "c", "t"]);
const LONG_WITH_VALUE = new Set([
	"--message",
	"--file",
	"--author",
	"--date",
	"--template",
	"--cleanup",
	"--reuse-message",
	"--reedit-message",
	"--fixup",
	"--squash",
	"--trailer",
	"--pathspec-from-file",
]);
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
		if (typeof command !== "string") return null;
		const m = COMMIT_RE.exec(command);
		if (!m) return null;
		const anchor = commitAnchor(command, m, eventCwd);
		const args = commitArgs(command.slice(m.index + m[0].length), commitCloser(m));
		return { kind: "commit", command, anchor, args };
	}
	return null;
}

/**
 * Which repository the commit lands in: the event cwd, moved by every `cd` in
 * an earlier segment of the same command (in order), then by every `-C <path>`
 * among git's own options. The match begins AT the separator, so the text
 * before it ends with one `&` of `&&` — split on runs of separator characters,
 * not on operators.
 */
function commitAnchor(command, match, cwd) {
	let anchor = cwd;
	for (const segment of command.slice(0, match.index).split(/[&|;\n]+/)) {
		const cd = /^\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/.exec(segment);
		if (cd) anchor = resolve(anchor, cd[1] ?? cd[2] ?? cd[3]);
	}
	for (const c of match[1].matchAll(/-C\s+(\S+)/g)) anchor = resolve(anchor, unquote(c[1]));
	return anchor;
}

/** The character that ends the commit's argument text when it sits inside a `-c` string or backticks; null when it runs to the segment's end. */
function commitCloser(match) {
	if (/-c\s+"$/.test(match[0])) return '"';
	if (/-c\s+'$/.test(match[0])) return "'";
	return match[0].includes("\x60") ? "\x60" : null;
}

function unquote(token) {
	return /^(["']).*\1$/.test(token) ? token.slice(1, -1) : token;
}

/**
 * The tokens after `commit` up to the end of its command segment — an unescaped
 * `; & | newline ) `` ` ``, or the quote that opened a `-c` string. Quotes group,
 * backslash escapes. Deliberately not a shell; enough to tell a flag, a flag's
 * value and a pathspec apart.
 */
function commitArgs(text, closer) {
	const tokens = [];
	let current = "";
	let has = false;
	let quote = null;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			if (ch === quote) quote = null;
			else if (ch === "\\" && quote === '"' && i + 1 < text.length) current += text[++i];
			else current += ch;
			continue;
		}
		if (ch === "\\" && i + 1 < text.length) {
			current += text[++i];
			has = true;
			continue;
		}
		if (ch === closer) break;
		if (ch === '"' || ch === "'") {
			quote = ch;
			has = true;
			continue;
		}
		if (/[;&|\n)\x60]/.test(ch)) break;
		if (/\s/.test(ch)) {
			if (has) tokens.push(current);
			current = "";
			has = false;
			continue;
		}
		current += ch;
		has = true;
	}
	if (has) tokens.push(current);
	return tokens;
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
	const intent = commitIntent(subject.args);
	subject.paths = [
		...stagedPaths(gitPath, intent.all).map((p) => real(resolve(gitPath, p))),
		...intent.paths.map((p) => real(resolve(subject.anchor, p))),
	];
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

/** What `git commit` would commit from the index, plus every tracked modification under `-a`/`--all`. */
function stagedPaths(repo, all) {
	const paths = new Set(gitLines(repo, ["diff", "--cached", "--name-only"]));
	if (all) for (const p of gitLines(repo, ["diff", "--name-only"])) paths.add(p);
	return [...paths];
}

/**
 * Read the commit's own arguments: is `-a` present (alone, `--all`, or inside a
 * cluster such as `-am`), and which bare tokens are pathspecs — everything after
 * `--`, and any token that is neither an option, an option's value, nor a
 * redirection. `git commit -m x src/a.ts` commits `src/a.ts` without staging it.
 */
function commitIntent(args) {
	let all = false;
	const paths = [];
	let rest = false;
	for (let i = 0; i < args.length; i++) {
		const token = args[i];
		if (rest) {
			paths.push(token);
			continue;
		}
		if (token === "--") {
			rest = true;
			continue;
		}
		if (token.startsWith("--")) {
			if (token === "--all") all = true;
			else if (LONG_WITH_VALUE.has(token)) i++;
			continue;
		}
		if (token.startsWith("-") && token.length > 1) {
			for (let j = 1; j < token.length; j++) {
				const flag = token[j];
				if (flag === "a") all = true;
				if (SHORT_WITH_VALUE.has(flag)) {
					if (j === token.length - 1) i++; // `-m x`: the value is the next token
					break; // `-mx`: the value is the rest of the cluster
				}
			}
			continue;
		}
		if (/^\d*[<>]|^&>/.test(token)) continue; // a redirection, not a path
		paths.push(token);
	}
	return { all, paths };
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
