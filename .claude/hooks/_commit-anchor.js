import { resolve } from "node:path";

/**
 * Where a `git commit` in a Bash command lands — the one reading shared by
 * `trunk-guard.js` (which judges the commit) and `eval-trigger.js` (which
 * evaluates it). Extracted 2026-10-05 for day-monitor A32: the evaluator kept
 * its own commit filter and took the repository from the session's directory,
 * so a commit made with `cd <worktree> && git commit` was evaluated as the
 * trunk's HEAD, and `git -C <dir> commit` was not recognised as a commit at
 * all. Two readings of one command diverge silently; this module is the only
 * one.
 */

// `git [options] commit` in command position: the start of the command, after a
// separator, inside `$(…)`/backticks, or as the string handed to `-c` (bash, sh,
// zsh). Git's own pre-verb options are captured so `-C <path>` can move the
// judged repository. Right-edge lookahead: `git commitment` is not a commit.
// `echo "git commit"` and `--grep 'git commit'` are not in command position and
// stay unmatched. Never String.includes.
const GIT_OPTIONS =
	"(?:\\s+(?:-C\\s+\\S+|-c\\s+\\S+|--git-dir(?:=\\S+|\\s+\\S+)|--work-tree(?:=\\S+|\\s+\\S+)|--no-pager|--no-optional-locks|--paginate|-[pP]))*";

/**
 * `git [options] <verb>` in command position, with the same reading as a
 * commit — `stash-guard.js` asks it for `stash`. `flags` adds `g` for a hook
 * that judges every occurrence in one command.
 */
export function gitVerbRe(verb, flags = "") {
	return new RegExp(
		`(?:^|[;&|(\\n]|\\x60|(?:^|\\s)-c\\s+["'])\\s*git(${GIT_OPTIONS})\\s+${verb}(?=$|\\s|[;&|)"'\\x60])`,
		flags,
	);
}

export const COMMIT_RE = gitVerbRe("commit");

/**
 * Which repository the commit (or any `gitVerbRe` match) lands in: the event cwd, moved by every `cd` in
 * an earlier segment of the same command (in order), then by every `-C <path>`
 * among git's own options. The match begins AT the separator, so the text
 * before it ends with one `&` of `&&` — split on runs of separator characters,
 * not on operators.
 */
export function commitAnchor(command, match, cwd) {
	let anchor = cwd;
	for (const segment of command.slice(0, match.index).split(/[&|;\n]+/)) {
		const cd = /^\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/.exec(segment);
		if (cd) anchor = resolve(anchor, cd[1] ?? cd[2] ?? cd[3]);
	}
	for (const c of match[1].matchAll(/-C\s+(\S+)/g)) anchor = resolve(anchor, unquote(c[1]));
	return anchor;
}

function unquote(token) {
	return /^(["']).*\1$/.test(token) ? token.slice(1, -1) : token;
}
