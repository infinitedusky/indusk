import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evalDir } from "../lib/bookkeeping/roots.js";
import { runHook } from "./helpers/hook-runner.js";
import { initRepoWithCommit } from "./helpers/test-git.js";

/**
 * day-monitor A32 — i-2026-10-05-every-commit-evaluated, cause 1.
 *
 * A commit made in a plan worktree from a session whose directory is the
 * trunk (`cd <worktree> && git commit …`) was evaluated as the trunk's HEAD:
 * the hook took the repository from the event's `cwd`. One trunk commit was
 * evaluated 14 times, and the evaluator finally refused ("HEAD is confirmed
 * unchanged across all seven requests").
 *
 * The hook must evaluate the repository the commit landed in — the same
 * reading `trunk-guard.js` makes of a preceding `cd` and `git -C`. Eval is
 * disabled in the fixture, so the hook logs where it would evaluate and stops
 * before spawning anything.
 */

describe("A32 — a worktree commit is evaluated in the worktree", () => {
	let root: string;
	let trunk: string;
	let worktree: string;

	beforeEach(() => {
		root = realpathSync(mkdtempSync(join(tmpdir(), "eval-anchor-")));
		trunk = join(root, "trunk");
		worktree = join(root, "trunk-worktrees", "a-plan");
		initRepoWithCommit(trunk);
		writeFileSync(join(trunk, ".gitignore"), ".indusk/eval/\n");
		execFileSync("git", ["-C", trunk, "add", "-A"]);
		execFileSync("git", ["-C", trunk, "commit", "-q", "-m", "ignore eval logs"]);
		execFileSync("git", ["-C", trunk, "worktree", "add", "-q", "-b", "plan/a-plan", worktree]);
		// Eval disabled: the hook logs `statePath … gitPath …` and exits before any spawn.
		const config = JSON.stringify({ eval: { enabled: false } });
		for (const dir of [trunk, worktree]) {
			execFileSync("mkdir", ["-p", join(dir, ".indusk")]);
			writeFileSync(join(dir, ".indusk", "config.json"), config);
		}
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	function gitPathLogged(): string {
		const log = readFileSync(join(evalDir(trunk), "system.log"), "utf-8");
		// Every case's checkout is named `trunk`, so they share one project home
		// and one system.log: the newest line is this case's.
		const line = log
			.split("\n")
			.filter((l) => l.includes("gitPath: "))
			.at(-1);
		if (!line) throw new Error(`no gitPath line in system.log:\n${log}`);
		return /gitPath: (.*?), eval\.enabled/.exec(line)?.[1] ?? "";
	}

	function event(command: string) {
		return {
			cwd: trunk,
			tool_name: "Bash",
			tool_input: { command },
			tool_response: { exit_code: 0 },
		};
	}

	it("`cd <worktree> && git commit` from the trunk evaluates the worktree", async () => {
		await runHook("eval-trigger.js", event(`cd ${worktree} && git commit -m "x"`), { cwd: trunk });
		expect(gitPathLogged()).toBe(worktree);
	});

	it("`git -C <worktree> commit` from the trunk evaluates the worktree", async () => {
		await runHook("eval-trigger.js", event(`git -C ${worktree} commit -m "x"`), { cwd: trunk });
		expect(gitPathLogged()).toBe(worktree);
	});

	it("a plain `git commit` in the trunk still evaluates the trunk", async () => {
		await runHook("eval-trigger.js", event(`git commit -m "x"`), { cwd: trunk });
		expect(gitPathLogged()).toBe(trunk);
	});
});
