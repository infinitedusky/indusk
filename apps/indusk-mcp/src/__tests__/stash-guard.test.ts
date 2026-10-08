import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { git, initRepoWithCommit } from "./helpers/test-git.js";
import { bash } from "./helpers/trunk-guard-fixture.js";

/**
 * small-fixes A9, A10 — promise: a-stash-never-crosses-worktrees.
 *
 * The stash stack lives in the shared git directory, so every worktree of a
 * repository pushes onto and pops from the same list. A bare `git stash pop`
 * in one worktree takes whatever is on top — which may be another session's
 * work, set aside in another worktree a minute earlier. The guard refuses the
 * spellings that act on "the top" or on nothing named, and lets through the
 * ones that name what they act on: a tagged push, a list, an apply by sha.
 *
 * In a repository with one worktree there is no one to collide with, and
 * nothing is refused.
 */

const bases: string[] = [];

function repo(worktrees: 1 | 2): { main: string; plan: string | null } {
	const base = realpathSync(mkdtempSync(join(tmpdir(), "stash-guard-")));
	bases.push(base);
	const main = join(base, "proj");
	initRepoWithCommit(main);
	if (worktrees === 1) return { main, plan: null };
	const plan = join(base, "proj-plan");
	git(main, ["worktree", "add", "-q", "-b", "plan/x", plan]);
	return { main, plan };
}

afterEach(() => {
	for (const b of bases.splice(0)) rmSync(b, { recursive: true, force: true });
});

const REFUSED = [
	"git stash",
	"git stash pop",
	"git stash drop",
	"git stash push",
	"git stash -u",
	"git stash pop stash@{0}",
	"git stash apply",
	"git stash clear",
	// A20: `branch <name>` with no stash named pops the top entry into a new branch.
	"git stash branch fix-x",
];

const ALLOWED = [
	'git stash push -u -m "wip-small-fixes"',
	"git stash push --message wip-small-fixes",
	"git stash list",
	"git stash list --format='%H %gs'",
	"git stash apply 1234567890abcdef1234567890abcdef12345678",
	"git stash drop stash@{2}",
	"git stash branch fix-x 1234567890abcdef1234567890abcdef12345678",
	"git stash show -p stash@{0}",
	"git status",
	'echo "git stash pop"',
];

describe("A9 — with more than one worktree, an unnamed stash is refused before it runs", () => {
	for (const command of REFUSED) {
		it(`refuses \`${command}\`, naming the safe way`, async () => {
			const { plan } = repo(2);
			const r = await runHook("stash-guard.js", bash(plan as string, command));
			expect(r.exitCode, r.stderr).toBe(2);
			expect(r.stderr).toContain("lesson: ");
			expect(r.stderr).toMatch(/temporary commit/);
			expect(r.stderr).toContain("git stash push -u -m");
			expect(r.stderr).toContain("git stash apply <sha>");
		});
	}

	it("refuses from the main checkout too — both ends share the stack", async () => {
		const { main } = repo(2);
		const r = await runHook("stash-guard.js", bash(main, "git stash pop"));
		expect(r.exitCode, r.stderr).toBe(2);
	});

	it("reads the repository the command moves to: `cd <worktree> && git stash`, `git -C <worktree> stash pop`", async () => {
		const { plan } = repo(2);
		const outside = realpathSync(mkdtempSync(join(tmpdir(), "stash-guard-outside-")));
		bases.push(outside);
		const viaCd = await runHook("stash-guard.js", bash(outside, `cd ${plan} && git stash`));
		expect(viaCd.exitCode, viaCd.stderr).toBe(2);
		const viaC = await runHook("stash-guard.js", bash(outside, `git -C ${plan} stash pop`));
		expect(viaC.exitCode, viaC.stderr).toBe(2);
	});
});

describe("A10 — named stashes are allowed; one worktree refuses nothing", () => {
	for (const command of ALLOWED) {
		it(`allows \`${command}\` with two worktrees`, async () => {
			const { plan } = repo(2);
			const r = await runHook("stash-guard.js", bash(plan as string, command));
			expect(r.exitCode, r.stderr).toBe(0);
		});
	}

	for (const command of REFUSED) {
		it(`allows \`${command}\` in a repository with one worktree`, async () => {
			const { main } = repo(1);
			const r = await runHook("stash-guard.js", bash(main, command));
			expect(r.exitCode, r.stderr).toBe(0);
		});
	}

	it("allows a non-Bash tool and a directory that is no repository", async () => {
		const outside = realpathSync(mkdtempSync(join(tmpdir(), "stash-guard-none-")));
		bases.push(outside);
		const noRepo = await runHook("stash-guard.js", bash(outside, "git stash pop"));
		expect(noRepo.exitCode, noRepo.stderr).toBe(0);
		const edit = await runHook("stash-guard.js", {
			tool_name: "Edit",
			tool_input: { file_path: join(outside, "a.ts"), old_string: "a", new_string: "b" },
			cwd: outside,
		});
		expect(edit.exitCode, edit.stderr).toBe(0);
	});
});
