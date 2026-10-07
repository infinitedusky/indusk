import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluatorPermissionArgs } from "./permissions.js";

/**
 * bookkeeping-lives-where-it-is-read, found building it: the evaluator,
 * grading a commit in a plan's live worktree, ran `git stash -u`, checked out
 * three files from an older commit, ran the tests and popped the stash, while
 * the working agent was editing there; its edits vanished and came back
 * staged. It ran with `--permission-mode bypassPermissions`, which ignores the
 * allowed-tools list. The evaluator reads the checkout it grades and changes
 * nothing in it: no bypass, read-only git, and the changing git commands
 * denied outright, since a deny rule holds whatever the mode.
 */

const args = evaluatorPermissionArgs();
const after = (flag: string) => args[args.indexOf(flag) + 1] ?? "";

describe("the evaluator only reads the checkout it grades", () => {
	it("does not bypass permissions", () => {
		expect(args).not.toContain("bypassPermissions");
		expect(after("--permission-mode")).toBe("dontAsk");
	});

	it("allows reading, read-only git and InDusk's tools, nothing else", () => {
		const allowed = after("--allowed-tools").split(",");
		expect(allowed).not.toContain("Bash(git:*)");
		expect(allowed).toEqual(
			expect.arrayContaining([
				"Read",
				"Grep",
				"Glob",
				"mcp__indusk__*",
				"Bash(git show:*)",
				"Bash(git diff:*)",
				"Bash(git log:*)",
			]),
		);
		expect(allowed.filter((t) => t.startsWith("Bash(") && !t.startsWith("Bash(git "))).toEqual([]);
	});

	it("denies every git command that changes the checkout", () => {
		const denied = after("--disallowed-tools").split(",");
		for (const cmd of [
			"stash",
			"checkout",
			"reset",
			"restore",
			"commit",
			"clean",
			"switch",
			"merge",
			"rebase",
		]) {
			expect(denied, cmd).toContain(`Bash(git ${cmd}:*)`);
		}
	});

	it("every place that starts the evaluator uses these permissions", () => {
		const here = dirname(fileURLToPath(import.meta.url));
		for (const file of ["evaluator-runner.ts", "persistent-evaluator.ts"]) {
			const source = readFileSync(join(here, file), "utf-8");
			expect(source, file).not.toContain("bypassPermissions");
			expect(source, file).toContain("evaluatorPermissionArgs()");
		}
	});
});
