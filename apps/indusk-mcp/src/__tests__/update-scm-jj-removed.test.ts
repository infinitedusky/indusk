import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * A6 (jj-residue-rip-out) — the `scm: "jj"` deprecation window is closed.
 *
 * This replaces `update-scm-jj-nudge.test.ts`, which asserted the opposite:
 * that `indusk update` emits a one-time stderr nudge on a `scm: "jj"` config.
 * That nudge shipped in 1.31.0 and is removed in Build Phase 3; five minor
 * versions is a long enough window.
 *
 * The load-bearing half of this test is that update still *succeeds*. Removing
 * the field from `InduskConfig` is a compile-time change only — `.indusk/
 * config.json` is read with a plain `JSON.parse` into a TypeScript interface,
 * with no zod schema and no runtime validation — so an old config carrying the
 * field must continue to parse and be ignored. This pins that rather than
 * assuming it.
 *
 * **This suite reaps the telemetry daemon it causes to spawn.** Running the CLI
 * against a temp `INDUSK_HOME` auto-enables the local-telemetry extension,
 * whose `on_enable` hook starts a jaeger + otelcol pair; deleting the temp home
 * afterwards destroys the only record of their PIDs, orphaning them forever.
 * Four existing suites do exactly that and had leaked ~1,027 pairs holding
 * 17.1 GB before being reaped by hand on 2026-08-13. Do not copy the old shape.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

describe.skipIf(SHOULD_SKIP)(
	"A6: indusk update on a legacy scm:jj config is silent and successful",
	{ timeout: 60000 },
	() => {
		let projectDir: string;
		let testHome: string;

		function runUpdate() {
			return spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				env: { ...process.env, INDUSK_HOME: testHome, INDUSK_SKIP_SELF_UPDATE: "1" },
				encoding: "utf-8",
			});
		}

		beforeEach(() => {
			projectDir = mkdtempSync(join(tmpdir(), "scm-jj-removed-proj-"));
			testHome = mkdtempSync(join(tmpdir(), "scm-jj-removed-home-"));
			spawnSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
			spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: projectDir });
			spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });
			spawnSync("git", ["commit", "--allow-empty", "-q", "-m", "initial"], { cwd: projectDir });
			mkdirSync(join(projectDir, ".indusk"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({ mode: "normal", scm: "jj" }, null, 2),
			);
		});

		afterEach(() => {
			// Stop the daemon BEFORE deleting the home that holds its PID record.
			// Once the home is gone the pair is unreapable except by hand.
			spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
				env: { ...process.env, INDUSK_HOME: testHome, INDUSK_SKIP_SELF_UPDATE: "1" },
				encoding: "utf-8",
			});
			rmSync(projectDir, { recursive: true, force: true });
			rmSync(testHome, { recursive: true, force: true });
		});

		it("emits no jj nudge", () => {
			const res = runUpdate();
			expect(res.status, `update failed: ${res.stderr}`).toBe(0);
			expect(`${res.stderr}\n${res.stdout}`).not.toMatch(/scm field no longer used/);
			expect(`${res.stderr}\n${res.stdout}`).not.toMatch(/\bjj\b/);
		});

		it("succeeds and leaves the legacy field untouched", () => {
			const res = runUpdate();
			expect(res.status, `update failed: ${res.stderr}`).toBe(0);

			// Nothing reads the field any more, so nothing should rewrite it either.
			const after = JSON.parse(readFileSync(join(projectDir, ".indusk/config.json"), "utf-8"));
			expect(after.scm).toBe("jj");
		});
	},
);
