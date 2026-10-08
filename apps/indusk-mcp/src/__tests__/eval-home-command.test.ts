import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bookkeepingRoots } from "../lib/bookkeeping/roots.js";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * bookkeeping-lives-where-it-is-read, found at its retrospective: the skills
 * that check the evaluator (`rail-check`, `eval-review`) read its logs, which
 * now live in the project's home, `<INDUSK_HOME>/projects/<id>-<hash>/`. A skill
 * cannot work the hash out, so `indusk eval home` prints the home, from any
 * checkout, for `"$(indusk eval home)/eval/results.log"`.
 *
 * promise: indusk-leaves-main-clean
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("indusk eval home", () => {
	it("prints the project's home, the same from the main checkout and a plan worktree", () => {
		const base = realpathSync(mkdtempSync(join(tmpdir(), "eval-home-")));
		dirs.push(base);
		const home = join(base, "home");
		const project = join(base, "proj");
		const worktree = join(base, "proj-plan");
		mkdirSync(project);
		git(project, ["init", "-q", "-b", "main"]);
		git(project, ["commit", "-q", "--allow-empty", "-m", "init"]);
		git(project, ["worktree", "add", "-q", "-b", "plan/x", worktree]);
		const expected = bookkeepingRoots(project, home).home;
		for (const cwd of [project, worktree]) {
			const r = runCli(cwd, ["eval", "home"], { INDUSK_HOME: home });
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout.trim()).toBe(expected);
		}
	});
});
