import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T13 + T14 — `indusk graph status` and `indusk graph rebuild` graceful-
 * degrade on git-mode projects with the same `git mode — semantic graph
 * unavailable` message that `runSync()` uses, instead of leaking jj-flavored
 * errors / misleading hints.
 *
 * RED AT PHASE 6 START. Today:
 *  - `graph status` prints `(no log file — run 'indusk graph sync' first)`
 *    on git-mode projects. Following that hint runs sync, which no-ops with
 *    a different message — confusing UX.
 *  - `graph rebuild` clears the runtime then attempts replay against an
 *    empty/absent log. Either no-ops silently or errors uninformatively.
 *
 * Goes green after H2-A + H2-B in Phase 6 land — both commands branch on
 * `getScm(projectRoot)` and emit the standard graceful-degrade message.
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
	testHome = mkdtempSync(join(tmpdir(), "git-graph-cli-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "git-graph-cli-proj-"));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "git-graph-cli-smoke", version: "0.0.0" }, null, 2),
	);
	expect(spawnSync("git", ["init", "-q"], { cwd: projectDir }).status).toBe(0);
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

describe.skipIf(SHOULD_SKIP)("graph CLI on git mode", { timeout: 60000 }, () => {
	it("T13: `indusk graph status` exits 0 with `git mode — semantic graph unavailable`, no misleading 'run sync first' hint", () => {
		// Init the project so config has scm: "git"
		const init = runCli(["init", "--no-index"]);
		expect(init.code, `init failed: ${init.stderr}`).toBe(0);

		const result = runCli(["graph", "status"]);
		expect(result.code, `graph status: ${result.stderr}`).toBe(0);
		// The graceful-degrade message should appear (stderr OR stdout — match
		// runSync's pattern but stay tolerant about which stream).
		const combined = `${result.stdout}\n${result.stderr}`;
		expect(combined).toMatch(/git mode/i);
		expect(combined).toMatch(/semantic graph unavailable/i);
		// And the misleading "run sync first" hint should NOT appear.
		expect(combined).not.toMatch(/run\s+'?indusk graph sync'?\s+first/i);
	});

	it("T14: `indusk graph rebuild` exits 0 with `git mode — semantic graph unavailable`, does not clear runtime or attempt replay", () => {
		const init = runCli(["init", "--no-index"]);
		expect(init.code, `init failed: ${init.stderr}`).toBe(0);

		const result = runCli(["graph", "rebuild"]);
		expect(result.code, `graph rebuild: ${result.stderr}`).toBe(0);
		const combined = `${result.stdout}\n${result.stderr}`;
		expect(combined).toMatch(/git mode/i);
		expect(combined).toMatch(/semantic graph unavailable/i);
		// Pre-fix output included things like "Clearing runtime..." or
		// "Replaying log..." — those should NOT appear after the fix because
		// the CLI early-returns before attempting the rebuild dance.
		expect(combined).not.toMatch(/Clearing runtime/i);
		expect(combined).not.toMatch(/Replaying log/i);
	});
});
