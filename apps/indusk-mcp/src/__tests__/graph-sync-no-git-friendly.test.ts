import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T15 (git-only-substrate Phase 6, falsification fix for H3) —
 * `indusk graph sync` in a directory that is not a git repository (or in
 * a git repository with zero commits) exits non-zero with a friendly
 * stderr message naming the cause. It does NOT print an unhandled stack
 * trace from `execFileAsync` rejection bubbling through `runSync`.
 *
 * RED AGAINST CURRENT CODE. `runSync()` calls `getCurrentChangeId()`
 * which awaits `execFileAsync("git", ["rev-parse", "--short", "HEAD"])`.
 * On error, the rejection propagates through runSync → cli.ts action →
 * unhandled. User gets a node stack trace. Phase 6 wraps the CLI action
 * + MCP wrapper in try/catch with friendly messages.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

describe.skipIf(SHOULD_SKIP)(
	"T15: indusk graph sync friendly errors on missing git state",
	{ timeout: 60000 },
	() => {
		let projectDir: string;
		let testHome: string;

		beforeEach(() => {
			projectDir = mkdtempSync(join(tmpdir(), "sync-no-git-proj-"));
			testHome = mkdtempSync(join(tmpdir(), "sync-no-git-home-"));
			// Bootstrap a minimal .indusk/config.json so the CLI doesn't bail at
			// rootOrExit. The sync engine itself is what we're testing.
			mkdirSync(join(projectDir, ".indusk"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({ mode: "normal" }, null, 2),
			);
		});

		afterEach(() => {
			rmSync(projectDir, { recursive: true, force: true });
			rmSync(testHome, { recursive: true, force: true });
		});

		it("not-a-git-repo: exits non-zero with a friendly stderr message, no stack trace", () => {
			// Intentionally no git init — the project dir is NOT a git repo.
			const res = spawnSync("node", [CLI_BIN, "graph", "sync"], {
				cwd: projectDir,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_SELF_UPDATE: "1",
				},
				encoding: "utf-8",
			});

			expect(res.status, "graph sync should exit non-zero").not.toBe(0);
			const combined = `${res.stderr}\n${res.stdout}`;
			// Friendly cause-naming language (one of these patterns must match)
			expect(combined).toMatch(/not a git repository|no git repo|git init/i);
			// No raw stack trace from execFileAsync rejection
			expect(combined).not.toMatch(/at execFileAsync/);
			expect(combined).not.toMatch(/at ChildProcess/);
			expect(combined).not.toMatch(/at runSync/);
		});

		it("git repo with zero commits: exits non-zero with a friendly stderr message", () => {
			spawnSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
			spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: projectDir });
			spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });
			// No commit yet — `git rev-parse --short HEAD` will fail.

			const res = spawnSync("node", [CLI_BIN, "graph", "sync"], {
				cwd: projectDir,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_SELF_UPDATE: "1",
				},
				encoding: "utf-8",
			});

			expect(res.status, "graph sync should exit non-zero on commitless repo").not.toBe(0);
			const combined = `${res.stderr}\n${res.stdout}`;
			expect(combined).toMatch(/no commits|git commit|HEAD/i);
			expect(combined).not.toMatch(/at execFileAsync/);
			expect(combined).not.toMatch(/at runSync/);
		});
	},
);
