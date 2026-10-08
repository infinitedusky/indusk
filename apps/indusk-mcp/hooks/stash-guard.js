#!/usr/bin/env node
/**
 * PreToolUse hook (Bash): a stash never crosses worktrees.
 * promise: a-stash-never-crosses-worktrees
 *
 * The stash stack lives in the repository's shared git directory, so every
 * worktree pushes onto and pops from the same list. A bare `git stash pop` in
 * one worktree takes whatever is on top — possibly another session's work, set
 * aside in another worktree a minute earlier — and a bare `git stash` pushes an
 * entry nobody else can tell from their own. On watcher-heartbeat an evaluator's
 * `git stash` took a working agent's uncommitted edits without a word.
 *
 * Rule: when the repository has more than one worktree, refuse the spellings
 * that act on "the top" or set aside something unnamed —
 *
 *   - `git stash`, `git stash -u`, `git stash push|save` with no message
 *   - `git stash pop` (any form — an index shifts under concurrent pushes)
 *   - `git stash apply` and `git stash drop` with nothing named
 *   - `git stash clear`
 *
 * and allow the ones that name what they act on: `push -m <tag>`, `list`,
 * `show`, `apply <sha>`, `drop stash@{n}` (re-found by its tag first).
 * With one worktree there is no one to collide with, and nothing is refused.
 *
 * Which repository is judged is read the way trunk-guard reads a commit:
 * the event cwd, moved by a preceding `cd` and by `git -C <path>`
 * (`_commit-anchor.js`, the one reading).
 *
 * Off switch, deliberate and visible: `INDUSK_STASH_GUARD=off` for one call.
 *
 * Exit 0 = allow. Exit 2 = block (stderr reaches the agent).
 */

import { execFileSync } from "node:child_process";
import { commitAnchor, gitVerbRe } from "./_commit-anchor.js";

if (process.env.INDUSK_STASH_GUARD === "off") process.exit(0);

let input = "";
for await (const chunk of process.stdin) input += chunk;
let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0); // never block on our own parse failure
}

if (event.tool_name !== "Bash") process.exit(0);
const command = event.tool_input?.command;
if (typeof command !== "string") process.exit(0);
const cwd = event.cwd ?? process.cwd();

for (const match of command.matchAll(gitVerbRe("stash", "g"))) {
	const args = stashArgs(command.slice(match.index + match[0].length));
	const refusal = unnamed(args);
	if (!refusal) continue;
	const repo = commitAnchor(command, match, cwd);
	const worktrees = worktreeCount(repo);
	if (worktrees < 2) continue;
	refuse(refusal, worktrees);
}
process.exit(0);

// ---------------------------------------------------------------------------

/** The words after `stash` up to the end of its command segment, quotes stripped. Not a shell; enough to find the subcommand and its named target. */
function stashArgs(text) {
	const end = text.search(/[;&|\n)\x60]/);
	return (end === -1 ? text : text.slice(0, end))
		.split(/\s+/)
		.map((t) => t.replace(/^["']|["']$/g, ""))
		.filter(Boolean);
}

/** Why this stash acts on something unnamed, or null when it names what it acts on. */
function unnamed(args) {
	const first = args[0];
	const sub = first === undefined || first.startsWith("-") ? "push" : first;
	const rest = sub === first ? args.slice(1) : args;
	const named = rest.some((t) => !t.startsWith("-"));
	switch (sub) {
		case "push":
			return hasMessage(rest)
				? null
				: "`git stash` with no message pushes an entry no one can tell from their own";
		case "save":
			return named || hasMessage(rest)
				? null
				: "`git stash save` with no message pushes an entry no one can tell from their own";
		case "pop":
			return "`git stash pop` takes the top of a stack every worktree shares, and an index shifts under another session's push";
		case "apply":
			return named
				? null
				: "`git stash apply` with nothing named applies the top of a stack every worktree shares";
		case "drop":
			return named
				? null
				: "`git stash drop` with nothing named drops the top of a stack every worktree shares";
		case "clear":
			return "`git stash clear` empties the stack for every worktree";
		default:
			return null; // list, show, branch <name> <stash>, create, store
	}
}

function hasMessage(tokens) {
	return tokens.some((t) => t === "-m" || t.startsWith("--message") || /^-[a-zA-Z]*m/.test(t));
}

/** How many worktrees the repository at `dir` has; 0 when `dir` is no repository. */
function worktreeCount(dir) {
	try {
		return execFileSync("git", ["worktree", "list", "--porcelain"], {
			cwd: dir,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.split("\n")
			.filter((l) => l.startsWith("worktree ")).length;
	} catch {
		return 0;
	}
}

function refuse(reason, worktrees) {
	process.stderr.write(
		[
			`stash-guard: refusing — ${reason}.`,
			"lesson: a-stash-never-crosses-worktrees",
			"",
			`This repository has ${worktrees} worktrees, and they share one stash stack.`,
			"Set work aside safely:",
			"  a temporary commit:  git commit -m 'wip: <what>'   (undo later with git reset --soft HEAD~1)",
			'  or a tagged stash:   git stash push -u -m "<unique-tag>"',
			"                       git stash list --format='%H %gs'   (note your entry's sha)",
			"                       git stash apply <sha>",
			"                       git stash drop stash@{n}   (re-find n by your tag first)",
			"",
			"Deliberate override: INDUSK_STASH_GUARD=off for one call.",
			"",
		].join("\n"),
	);
	process.exit(2);
}
