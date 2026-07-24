import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T10 (git-only-substrate Phase 5) — `indusk update` on a project whose
 * `.indusk/config.json` has `scm: "jj"` emits exactly one stderr nudge
 * ("scm field no longer used; safe to remove from .indusk/config.json")
 * and leaves the config file's contents byte-unchanged.
 *
 * Pre-1.31.0 behavior: `indusk update` ran `detectScm()` and wrote the
 * field to the config. After Phase 4 + Phase 5 the abstraction is gone
 * and the field is a no-op; the migration is a single stderr line that
 * tells the user to remove the field manually.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

describe.skipIf(SHOULD_SKIP)(
	"T10: indusk update nudges on scm:jj config but leaves the file unchanged",
	{ timeout: 60000 },
	() => {
		let projectDir: string;
		let testHome: string;

		beforeEach(() => {
			projectDir = mkdtempSync(join(tmpdir(), "scm-jj-nudge-proj-"));
			testHome = mkdtempSync(join(tmpdir(), "scm-jj-nudge-home-"));
			// Need a git repo so indusk update doesn't fail on git_init walks
			spawnSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
			spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: projectDir });
			spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });
			spawnSync("git", ["commit", "--allow-empty", "-q", "-m", "initial"], { cwd: projectDir });
			// Bootstrap minimal .indusk/config.json with scm: "jj"
			mkdirSync(join(projectDir, ".indusk"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({ mode: "normal", scm: "jj" }, null, 2),
			);
		});

		afterEach(() => {
			rmSync(projectDir, { recursive: true, force: true });
			rmSync(testHome, { recursive: true, force: true });
		});

		it("stderr contains the nudge AND the scm:jj value is preserved", () => {
			const configPath = join(projectDir, ".indusk/config.json");

			const res = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_SELF_UPDATE: "1",
				},
				encoding: "utf-8",
			});

			expect(res.status, `update failed: ${res.stderr}`).toBe(0);

			const stderrAndStdout = `${res.stderr}\n${res.stdout}`;
			expect(stderrAndStdout).toMatch(
				/scm field no longer used; safe to remove from \.indusk\/config\.json/,
			);

			// The scm field is left intact — InDusk doesn't remove it. Other
			// migrations (e.g., agents.stale_ttl_minutes) may add fields and
			// reformat the file, but the scm value itself is preserved so the
			// user can decide when to remove it.
			const after = JSON.parse(readFileSync(configPath, "utf-8"));
			expect(after.scm).toBe("jj");
		});

		it("project with no scm field: no nudge", () => {
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({ mode: "normal" }, null, 2),
			);

			const res = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_SELF_UPDATE: "1",
				},
				encoding: "utf-8",
			});

			expect(res.status, `update failed: ${res.stderr}`).toBe(0);
			expect(`${res.stderr}\n${res.stdout}`).not.toMatch(/scm field no longer used/);
		});
	},
);
