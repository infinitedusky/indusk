import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T14 (git-only-substrate Phase 6, falsification fix for H1) —
 * `indusk init` in a directory without `git init` emits a stderr warning
 * naming git as the required SCM and pointing at `git init` as the next
 * step.
 *
 * RED AGAINST CURRENT CODE. Phase 4 deleted the pre-1.31.0 deferred-SCM
 * warning block; nothing was added in its place. Phase 6 adds a scoped
 * "git is required" warning at init close — informational, init still
 * succeeds.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

describe.skipIf(SHOULD_SKIP)(
	"T14: indusk init in non-git directory warns about missing git",
	{ timeout: 60000 },
	() => {
		let projectDir: string;
		let testHome: string;

		beforeEach(() => {
			projectDir = mkdtempSync(join(tmpdir(), "init-no-git-proj-"));
			testHome = mkdtempSync(join(tmpdir(), "init-no-git-home-"));
			// Intentionally DO NOT git init the project dir
		});

		afterEach(() => {
			rmSync(projectDir, { recursive: true, force: true });
			rmSync(testHome, { recursive: true, force: true });
		});

		it("emits a stderr warning naming git as the required SCM", () => {
			const res = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_SELF_UPDATE: "1",
				},
				encoding: "utf-8",
			});

			// Init still succeeds (informational warning, not a hard error)
			expect(res.status, `init should still exit 0 in non-git dir: ${res.stderr}`).toBe(0);

			// Stderr contains the warning, naming git + the recovery command
			expect(res.stderr).toMatch(/git/i);
			expect(res.stderr).toMatch(/git init/);
		});

		it("init in a git-initialized directory does NOT emit the warning", () => {
			spawnSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
			spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: projectDir });
			spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });

			const res = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_SELF_UPDATE: "1",
				},
				encoding: "utf-8",
			});

			expect(res.status, `init failed: ${res.stderr}`).toBe(0);
			// The "git is required" warning is git-only — must NOT fire when git is present.
			// Distinguishing: the warning will reference `git init` as a NEXT step;
			// a green init shouldn't suggest that.
			expect(res.stderr).not.toMatch(/run.*`?git init`?/i);
		});
	},
);
