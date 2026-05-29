import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * T1-T3 — setup-worktree.sh end-to-end.
 *
 *  T1: `setup-worktree.sh <slug>` creates the worktree dir at workbench
 *      root, branched off configured base.
 *  T2: `copy_files[]` + `append_files[]` are honored on create — files
 *      land in the worktree with correct content + sentinel headers.
 *  T3: `apply_commits[]` writes file contents at <sha> AND marks them
 *      skip-worktree (invisible to `git status`).
 *
 * Tests spawn the bash script as a subprocess against a tmpdir fixture
 * (workbench + canonical clone). The fixture is fully isolated; cleanup
 * is rm -rf of the tmpdir root.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SETUP_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh",
);

let fixture: WorktreeFixture;

afterEach(() => {
	fixture?.cleanup();
});

function runSetup(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync(SETUP_SCRIPT, args, {
		cwd,
		encoding: "utf-8",
		env: { ...process.env },
	});
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

describe("setup-worktree.sh", () => {
	describe("T1: worktree create + branch off configured base", () => {
		beforeEach(() => {
			fixture = buildWorktreeFixture({
				worktreeConfig: { trunk_branch: "main", base_branch: "main" },
			});
		});

		it("creates the worktree dir at workbench root", () => {
			const r = runSetup(fixture.workbenchDir, ["my-feature"]);
			expect(r.code, r.stderr).toBe(0);
			const worktreePath = join(fixture.workbenchDir, "my-feature");
			expect(existsSync(worktreePath)).toBe(true);
			expect(statSync(worktreePath).isDirectory()).toBe(true);
		});

		it("branches the new worktree off the configured base", () => {
			const r = runSetup(fixture.workbenchDir, ["my-feature"]);
			expect(r.code, r.stderr).toBe(0);
			const branchInWt = git(join(fixture.workbenchDir, "my-feature"), [
				"branch",
				"--show-current",
			]);
			expect(branchInWt.code).toBe(0);
			expect(branchInWt.stdout.trim()).toBe("my-feature");
		});

		it("rejects creating a worktree whose slug collides with the wrapped repo name", () => {
			// repo name in the fixture is "clone"
			const r = runSetup(fixture.workbenchDir, ["clone"]);
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/collides with the wrapped repo name/);
		});

		it("rejects creating a worktree that already exists (T14 dependency)", () => {
			const r1 = runSetup(fixture.workbenchDir, ["dup"]);
			expect(r1.code, r1.stderr).toBe(0);
			const r2 = runSetup(fixture.workbenchDir, ["dup"]);
			expect(r2.code).not.toBe(0);
			expect(r2.stderr).toMatch(/already exists/);
		});

		it("writes .indusk-overlay-state.json under the per-worktree gitdir (invisible to git status)", () => {
			const r = runSetup(fixture.workbenchDir, ["state-test"]);
			expect(r.code, r.stderr).toBe(0);
			const worktreePath = join(fixture.workbenchDir, "state-test");
			const gitdirResult = git(worktreePath, ["rev-parse", "--git-dir"]);
			const stateFile = join(gitdirResult.stdout.trim(), "indusk-overlay-state.json");
			expect(existsSync(stateFile)).toBe(true);
			expect(JSON.parse(readFileSync(stateFile, "utf-8"))).toEqual({
				apply_commits: [],
			});
			// git status should be empty (state file is under the gitdir, not the worktree)
			const status = git(worktreePath, ["status", "--short"]);
			expect(status.stdout).toBe("");
		});
	});

	describe("T2: copy_files + append_files honored on create", () => {
		beforeEach(() => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					copy_files: [{ src: ".env.example", dest: ".env.local" }],
					append_files: [{ src: "overrides.env", dest: ".env.local" }],
				},
				// extraFiles land in the canonical clone on main; the worktree
				// will then have `.env.example` available to copy from.
				extraFiles: [
					{
						path: ".env.example",
						content: "EXAMPLE_KEY=example-value\n",
					},
				],
			});
			// The append source lives in the workbench (per the schema's
			// `append_files[].src` semantics — relative to workbench root).
			writeFileSync(join(fixture.workbenchDir, "overrides.env"), "OVERRIDE_KEY=override-value\n");
		});

		it("copies copy_files entries from canonical clone to worktree", () => {
			const r = runSetup(fixture.workbenchDir, ["t2-copy"]);
			expect(r.code, r.stderr).toBe(0);
			const envLocal = join(fixture.workbenchDir, "t2-copy", ".env.local");
			expect(existsSync(envLocal)).toBe(true);
			const content = readFileSync(envLocal, "utf-8");
			// Copied content + appended content with sentinel header
			expect(content).toContain("EXAMPLE_KEY=example-value");
			expect(content).toContain("OVERRIDE_KEY=override-value");
		});

		it("wraps appended content in sentinel headers (so refresh can replace idempotently later)", () => {
			const r = runSetup(fixture.workbenchDir, ["t2-sentinel"]);
			expect(r.code, r.stderr).toBe(0);
			const envLocal = join(fixture.workbenchDir, "t2-sentinel", ".env.local");
			const content = readFileSync(envLocal, "utf-8");
			expect(content).toMatch(/# --- worktree-extension append \(overrides\.env\) ---/);
			expect(content).toMatch(/# --- end worktree-extension append ---/);
		});

		it("warns (does not fail) when a copy_files src is missing in the canonical clone", () => {
			fixture.cleanup();
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					copy_files: [{ src: "does-not-exist.txt", dest: "x.txt" }],
				},
			});
			const r = runSetup(fixture.workbenchDir, ["t2-missing"]);
			expect(r.code, r.stderr).toBe(0); // missing source is a warning, not a failure
			expect(r.stdout).toMatch(/WARN:\s+does-not-exist\.txt not found/);
		});
	});

	describe("T3: apply_commits writes upstream content + skip-worktree (invisible to git)", () => {
		let upstreamSha: string;

		beforeEach(() => {
			fixture = buildWorktreeFixture({
				worktreeConfig: { trunk_branch: "main" },
				extraFiles: [{ path: "packages/types/index.ts", content: "export type Old = 1;\n" }],
			});
			// Create a side branch in the canonical clone with a different
			// version of the file. This is the "unmerged-upstream" SHA we'll
			// overlay into a worktree.
			git(fixture.cloneDir, ["checkout", "-b", "upstream"]);
			writeFileSync(join(fixture.cloneDir, "packages/types/index.ts"), "export type New = 2;\n");
			git(fixture.cloneDir, ["add", "-A"]);
			const commit = spawnSync(
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
			expect(commit.status).toBe(0);
			const sha = spawnSync("git", ["rev-parse", "upstream"], {
				cwd: fixture.cloneDir,
				encoding: "utf-8",
			});
			upstreamSha = sha.stdout.trim();
			// Back to main so the worktree branches off the OLD version.
			git(fixture.cloneDir, ["checkout", "main"]);

			// Rewrite config to apply_commits[] the upstream SHA
			writeFileSync(
				fixture.worktreeConfigPath,
				JSON.stringify(
					{
						trunk_branch: "main",
						apply_commits: [{ sha: upstreamSha, files: ["packages/types/index.ts"] }],
					},
					null,
					2,
				),
			);
		});

		it("writes the upstream content into the worktree", () => {
			const r = runSetup(fixture.workbenchDir, ["t3-overlay"]);
			expect(r.code, r.stderr).toBe(0);
			const overlaid = readFileSync(
				join(fixture.workbenchDir, "t3-overlay", "packages/types/index.ts"),
				"utf-8",
			);
			expect(overlaid).toBe("export type New = 2;\n");
		});

		it("marks overlaid files skip-worktree (invisible to git status)", () => {
			const r = runSetup(fixture.workbenchDir, ["t3-skip"]);
			expect(r.code, r.stderr).toBe(0);
			const worktreePath = join(fixture.workbenchDir, "t3-skip");
			// The overlaid file should NOT appear in git status, even though
			// its content diverges from main's version.
			const status = git(worktreePath, ["status", "--short"]);
			expect(status.stdout).toBe("");
			// Verify the skip-worktree flag is actually set on the file
			const lsFiles = spawnSync("git", ["ls-files", "-v", "packages/types/index.ts"], {
				cwd: worktreePath,
				encoding: "utf-8",
			});
			// 'S' prefix = skip-worktree
			expect(lsFiles.stdout).toMatch(/^S /);
		});

		it("snapshots applied apply_commits[] into the state file", () => {
			const r = runSetup(fixture.workbenchDir, ["t3-state"]);
			expect(r.code, r.stderr).toBe(0);
			const gitdir = git(join(fixture.workbenchDir, "t3-state"), ["rev-parse", "--git-dir"]);
			const state = JSON.parse(
				readFileSync(join(gitdir.stdout.trim(), "indusk-overlay-state.json"), "utf-8"),
			) as { apply_commits: Array<{ sha: string; files: string[] }> };
			expect(state.apply_commits).toHaveLength(1);
			expect(state.apply_commits[0].sha).toBe(upstreamSha);
			expect(state.apply_commits[0].files).toEqual(["packages/types/index.ts"]);
		});
	});
});
