import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * T4 — ADR D7 fix-in-scope. When an entry is REMOVED from `apply_commits[]`
 * between two refresh runs, `refresh-worktree.sh` must:
 *   1. Clear the skip-worktree flag on the formerly-overlaid file
 *   2. Restore the file from HEAD (so the overlaid content goes away)
 *
 * Without this, files keep their stale overlay invisibly — the original
 * dawn-fde-toolkit's refresh-worktree.sh shipped with this bug.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SETUP_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh",
);
const REFRESH_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/refresh-worktree.sh",
);

let fixture: WorktreeFixture;

afterEach(() => {
	fixture?.cleanup();
});

function run(
	script: string,
	cwd: string,
	args: string[],
): { code: number; stdout: string; stderr: string } {
	const r = spawnSync(script, args, { cwd, encoding: "utf-8" });
	return {
		code: r.status ?? -1,
		stdout: r.stdout,
		stderr: r.stderr,
	};
}

function git(cwd: string, args: string[]): { code: number; stdout: string } {
	const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
	return { code: r.status ?? -1, stdout: r.stdout };
}

describe("refresh-worktree.sh clears skip-worktree on removed apply_commits entries (ADR D7)", () => {
	it("removing an apply_commits entry between refresh runs restores the file from HEAD and clears skip-worktree", () => {
		// Setup: canonical clone has packages/types/index.ts with 'Old' on main.
		// Side branch 'upstream' rewrites it to 'New'. We'll overlay the upstream
		// version, then remove the entry from config, refresh, and assert the
		// file restores to 'Old'.
		fixture = buildWorktreeFixture({
			worktreeConfig: { trunk_branch: "main" },
			extraFiles: [{ path: "packages/types/index.ts", content: "export type Old = 1;\n" }],
		});

		git(fixture.cloneDir, ["checkout", "-b", "upstream"]);
		writeFileSync(join(fixture.cloneDir, "packages/types/index.ts"), "export type New = 2;\n");
		git(fixture.cloneDir, ["add", "-A"]);
		spawnSync(
			"git",
			[
				"-c",
				"user.email=test@test.local",
				"-c",
				"user.name=test",
				"commit",
				"-q",
				"-m",
				"upstream change",
			],
			{ cwd: fixture.cloneDir, encoding: "utf-8" },
		);
		const sha = spawnSync("git", ["rev-parse", "upstream"], {
			cwd: fixture.cloneDir,
			encoding: "utf-8",
		}).stdout.trim();
		git(fixture.cloneDir, ["checkout", "main"]);

		// Write config with apply_commits[] entry, then setup the worktree.
		writeFileSync(
			fixture.worktreeConfigPath,
			JSON.stringify(
				{
					trunk_branch: "main",
					apply_commits: [{ sha, files: ["packages/types/index.ts"] }],
				},
				null,
				2,
			),
		);

		const setupResult = run(SETUP_SCRIPT, fixture.workbenchDir, ["t4"]);
		expect(setupResult.code, setupResult.stderr).toBe(0);

		const worktreePath = join(fixture.workbenchDir, "t4");
		const filePath = join(worktreePath, "packages/types/index.ts");

		// After setup: file has upstream content, skip-worktree is set.
		expect(readFileSync(filePath, "utf-8")).toBe("export type New = 2;\n");
		const lsBefore = spawnSync("git", ["ls-files", "-v", "packages/types/index.ts"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		expect(lsBefore.stdout).toMatch(/^S /);
		expect(git(worktreePath, ["status", "--short"]).stdout).toBe("");

		// Now REMOVE the apply_commits entry from config and refresh.
		writeFileSync(fixture.worktreeConfigPath, JSON.stringify({ trunk_branch: "main" }, null, 2));

		const refreshResult = run(REFRESH_SCRIPT, fixture.workbenchDir, ["t4"]);
		expect(refreshResult.code, refreshResult.stderr).toBe(0);
		expect(refreshResult.stdout).toMatch(/Clearing skip-worktree/);

		// After refresh: file should be back to main's content (Old).
		expect(readFileSync(filePath, "utf-8")).toBe("export type Old = 1;\n");

		// And the skip-worktree flag should be cleared.
		const lsAfter = spawnSync("git", ["ls-files", "-v", "packages/types/index.ts"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		expect(lsAfter.stdout).toMatch(/^H /); // 'H' = normally tracked, no flags

		// git status should still be clean (file matches HEAD now).
		expect(git(worktreePath, ["status", "--short"]).stdout).toBe("");
	});

	it("re-running refresh with no config change is idempotent (no spurious skip-worktree churn)", () => {
		fixture = buildWorktreeFixture({
			worktreeConfig: {
				trunk_branch: "main",
				copy_files: [{ src: "README.md", dest: ".env.local" }],
			},
		});
		const setupResult = run(SETUP_SCRIPT, fixture.workbenchDir, ["t4-idem"]);
		expect(setupResult.code, setupResult.stderr).toBe(0);
		const refreshA = run(REFRESH_SCRIPT, fixture.workbenchDir, ["t4-idem"]);
		expect(refreshA.code, refreshA.stderr).toBe(0);
		const refreshB = run(REFRESH_SCRIPT, fixture.workbenchDir, ["t4-idem"]);
		expect(refreshB.code, refreshB.stderr).toBe(0);
		// Neither refresh should report clearing anything (no entries removed).
		expect(refreshA.stdout).not.toMatch(/Clearing skip-worktree/);
		expect(refreshB.stdout).not.toMatch(/Clearing skip-worktree/);
	});
});
