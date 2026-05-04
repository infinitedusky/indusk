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
 * T4 — `indusk graph sync` on a git-mode project graceful-degrades: exits 0,
 * prints a "git mode — semantic graph unavailable" message to stderr, and
 * does not write any events to `.indusk/graph/semantic-graph.log`.
 *
 * RED AT PHASE 2 START. Today the sync engine calls `getCurrentChangeId()`
 * from `lib/semantic-graph/jj.ts` which throws `NotAJjRepoError` on a
 * git-only project — non-zero exit, error stderr, no graceful-degrade message.
 *
 * Runs against the built CLI (`dist/bin/cli.js`) with INDUSK_HOME pointed at
 * a tmpdir.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

function pathWithoutJj(): string {
	const which = spawnSync("which", ["jj"], { encoding: "utf-8" });
	if (which.status !== 0) return process.env.PATH ?? "";
	const jjDir = dirname(which.stdout.trim());
	return (process.env.PATH ?? "")
		.split(":")
		.filter((p) => p !== jjDir)
		.join(":");
}

function runCli(args: string[]): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: {
			...process.env,
			PATH: pathWithoutJj(),
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

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "git-graph-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "git-graph-proj-"));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "git-graph-smoke", version: "0.0.0" }, null, 2),
	);
	// Make this a git repo
	const gitInit = spawnSync("git", ["init", "-q"], { cwd: projectDir });
	expect(gitInit.status).toBe(0);
	spawnSync("git", ["config", "user.email", "test@test.invalid"], {
		cwd: projectDir,
	});
	spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });
});

afterEach(() => {
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(projectDir))
		rmSync(projectDir, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("graph sync on git mode (T4)", () => {
	it("exits 0, prints 'git mode — semantic graph unavailable', writes no events", () => {
		// Init the project first so config has scm: "git"
		const initResult = runCli(["init", "--no-index"]);
		expect(initResult.code, `init failed: ${initResult.stderr}`).toBe(0);

		const configPath = join(projectDir, ".indusk/config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.scm).toBe("git");

		// Now run graph sync — should graceful-degrade, not throw
		const syncResult = runCli(["graph", "sync"]);
		expect(
			syncResult.code,
			`graph sync should exit 0, got ${syncResult.code}.\nstdout:\n${syncResult.stdout}\nstderr:\n${syncResult.stderr}`,
		).toBe(0);
		expect(syncResult.stderr).toMatch(/git mode/i);
		expect(syncResult.stderr).toMatch(/semantic graph unavailable/i);

		// And no event log was written
		const logPath = join(projectDir, ".indusk/graph/semantic-graph.log");
		if (existsSync(logPath)) {
			const content = readFileSync(logPath, "utf-8");
			expect(content.trim()).toBe("");
		}
	});
});
