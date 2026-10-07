/**
 * The evaluator's permissions on the checkout it grades: it reads, and
 * changes nothing. It runs where the commit was made, often a plan's live
 * worktree with someone working in it, and once ran `git stash -u`, checked
 * out older files, ran the tests and popped the stash there, under
 * `--permission-mode bypassPermissions`, which ignores the allowed-tools list
 * (bookkeeping-lives-where-it-is-read). No bypass: `dontAsk` refuses anything
 * not allowed. Git is allowed only for commands that read, and the commands
 * that change a checkout are denied outright, since a deny rule holds
 * whatever the mode. Its lessons and highlight marks go through InDusk's own
 * tools, which write the main checkout and the project's home.
 */

const READ_ONLY_GIT = [
	"show",
	"diff",
	"log",
	"status",
	"blame",
	"rev-parse",
	"ls-files",
	"cat-file",
	"branch --show-current",
	"merge-base",
];

const CHANGING_GIT = [
	"stash",
	"checkout",
	"reset",
	"restore",
	"commit",
	"clean",
	"switch",
	"merge",
	"rebase",
	"cherry-pick",
	"revert",
	"add",
	"rm",
	"mv",
	"apply",
	"am",
	"pull",
	"push",
	"worktree",
	"tag",
	"update-ref",
];

export function evaluatorPermissionArgs(): string[] {
	return [
		"--permission-mode",
		"dontAsk",
		"--allowed-tools",
		[
			"Read",
			"Grep",
			"Glob",
			...READ_ONLY_GIT.map((c) => `Bash(git ${c}:*)`),
			"mcp__indusk__*",
		].join(","),
		"--disallowed-tools",
		CHANGING_GIT.map((c) => `Bash(git ${c}:*)`).join(","),
	];
}
