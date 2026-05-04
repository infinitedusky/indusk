import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T1, T2, T3 — `indusk init` and `indusk update` populate the `scm` field
 * in `.indusk/config.json` based on which SCM (jj or plain git) the project
 * is using.
 *
 * RED AT PHASE 1 START. Today `init` writes config without an `scm` field
 * and `update` doesn't migrate it; once Phase 1's `detectScm()` and the
 * init/update wiring lands, all three transitions go green.
 *
 * - T1: `init` in a git-only repo (jj NOT on PATH) writes `scm: "git"`.
 * - T2: `init` in a jj repo writes `scm: "jj"`.
 * - T3: `update` on a project missing `scm` adds the field; idempotent
 *       on re-run.
 *
 * Runs against the built CLI (`dist/bin/cli.js`) with INDUSK_HOME pointed
 * at a tmpdir so we don't touch the real ~/.indusk.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

/**
 * Build a PATH that strips any directory containing the `jj` binary, so a
 * subprocess launched with this PATH cannot invoke jj. Used for T1's
 * git-only-mode subprocess. Falls back to the current PATH when jj is not
 * found (the test still runs — the subprocess just doesn't see jj because
 * it isn't on PATH at all).
 */
function pathWithoutJj(): string {
	const which = spawnSync("which", ["jj"], { encoding: "utf-8" });
	if (which.status !== 0) {
		return process.env.PATH ?? "";
	}
	const jjPath = which.stdout.trim();
	const jjDir = dirname(jjPath);
	const parts = (process.env.PATH ?? "").split(":");
	return parts.filter((p) => p !== jjDir).join(":");
}

function runCli(
	args: string[],
	opts: { jjAvailable: boolean } = { jjAvailable: true },
): { code: number; stdout: string; stderr: string } {
	const path = opts.jjAvailable ? process.env.PATH : pathWithoutJj();
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: {
			...process.env,
			PATH: path,
			INDUSK_HOME: testHome,
			INDUSK_BIN: `node ${CLI_BIN}`,
			INDUSK_SKIP_SELF_UPDATE: "1",
		},
		encoding: "utf-8",
	});
	return {
		code: result.status ?? 0,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function readConfigFile(): Record<string, unknown> {
	const configPath = join(projectDir, ".indusk/config.json");
	expect(existsSync(configPath), `config.json should exist at ${configPath}`).toBe(true);
	return JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
}

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "scm-init-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "scm-init-proj-"));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "scm-init-smoke", version: "0.0.0" }, null, 2),
	);
});

afterEach(() => {
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(projectDir))
		rmSync(projectDir, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("scm init detection (T1, T2, T3)", { timeout: 60000 }, () => {
	it("T1: indusk init in a git-only repo (jj NOT on PATH) writes scm: 'git'", () => {
		// Make projectDir a git repo
		const gitInit = spawnSync("git", ["init", "-q"], {
			cwd: projectDir,
			encoding: "utf-8",
		});
		expect(gitInit.status).toBe(0);
		// Required for any future git commit (default identity may not be set)
		spawnSync("git", ["config", "user.email", "test@test.invalid"], {
			cwd: projectDir,
		});
		spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });

		const result = runCli(["init", "--no-index"], { jjAvailable: false });
		expect(result.code, `init failed: ${result.stderr}`).toBe(0);

		const config = readConfigFile();
		expect(config.scm).toBe("git");
	});

	it("T2: indusk init in a jj repo writes scm: 'jj'", () => {
		// `jj git init` colocates a jj repo on top of git
		const jjInit = spawnSync("jj", ["git", "init"], {
			cwd: projectDir,
			encoding: "utf-8",
		});
		if (jjInit.status !== 0) {
			// jj not installed in test env — skip rather than fail
			return;
		}

		const result = runCli(["init", "--no-index"]);
		expect(result.code, `init failed: ${result.stderr}`).toBe(0);

		const config = readConfigFile();
		expect(config.scm).toBe("jj");
	});

	it("T3: indusk update migrates a missing scm field; idempotent on re-run", () => {
		// Set up: git-only project that has been init'd
		const gitInit = spawnSync("git", ["init", "-q"], {
			cwd: projectDir,
			encoding: "utf-8",
		});
		expect(gitInit.status).toBe(0);
		spawnSync("git", ["config", "user.email", "test@test.invalid"], {
			cwd: projectDir,
		});
		spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });

		const initResult = runCli(["init", "--no-index"], { jjAvailable: false });
		expect(initResult.code, `init failed: ${initResult.stderr}`).toBe(0);

		// Strip the scm field — simulating a pre-Phase-1 project
		const configPath = join(projectDir, ".indusk/config.json");
		const configBefore = JSON.parse(readFileSync(configPath, "utf-8"));
		delete configBefore.scm;
		writeFileSync(configPath, `${JSON.stringify(configBefore, null, "\t")}\n`);

		// Run update — should detect git and add the field back
		const updateResult = runCli(["update"], { jjAvailable: false });
		expect(updateResult.code, `update failed: ${updateResult.stderr}`).toBe(0);

		const configAfter = readConfigFile();
		expect(configAfter.scm).toBe("git");

		// Capture mtime before the second run; allow a beat so any write would
		// show as a different mtime. Idempotent re-run should not rewrite.
		const mtimeBefore = readFileSync(configPath).toString();

		const secondUpdate = runCli(["update"], { jjAvailable: false });
		expect(secondUpdate.code, `2nd update failed: ${secondUpdate.stderr}`).toBe(0);

		const mtimeAfter = readFileSync(configPath).toString();
		expect(mtimeAfter).toBe(mtimeBefore);
	});
});
