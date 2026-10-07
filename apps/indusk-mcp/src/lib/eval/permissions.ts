/** The evaluator's permissions on the checkout it grades. */
export function evaluatorPermissionArgs(): string[] {
	return [
		"--permission-mode",
		"bypassPermissions",
		"--allowed-tools",
		["Read", "Grep", "Glob", "Bash(git:*)", "mcp__indusk__*"].join(","),
	];
}
