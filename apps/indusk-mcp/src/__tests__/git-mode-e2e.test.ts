import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * End-to-end harness for git-mode InDusk — verifies the full sequence:
 *
 *   git init → indusk init → config has scm: "git" → indusk graph sync
 *   no-ops gracefully → impl plan exists → all without throwing
 *
 * The eval baseline / scorecard step is NOT exercised here — that path
 * requires the `claude` CLI and a real Claude Code session, which is
 * covered by the manual smoke at apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md
 * (T8). This harness covers everything that doesn't need claude.
 *
 * Most assertions overlap with the focused tests (scm-init-detection,
 * git-mode-graph-sync); the value here is sequence integration — proving
 * the pieces compose without surprise interactions.
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
	testHome = mkdtempSync(join(tmpdir(), "git-e2e-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "git-e2e-proj-"));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "git-e2e-smoke", version: "0.0.0" }, null, 2),
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

describe.skipIf(SHOULD_SKIP)(
	"git-mode end-to-end sequence",
	{ timeout: 60000 },
	() => {
		it("init → graph sync → impl-plan creation → second sync all succeed without throwing", () => {
			// 1. init
			const init = runCli(["init", "--no-index"]);
			expect(init.code, `init failed: ${init.stderr}`).toBe(0);
			const config = JSON.parse(
				readFileSync(join(projectDir, ".indusk/config.json"), "utf-8"),
			);
			expect(config.scm).toBe("git");

			// 2. graph sync (1st run, empty log)
			const sync1 = runCli(["graph", "sync"]);
			expect(sync1.code, `1st graph sync failed: ${sync1.stderr}`).toBe(0);
			expect(sync1.stderr).toMatch(/git mode/i);

			// 3. Add a tiny plan to simulate a real project state
			const planDir = join(projectDir, ".indusk/planning/sample-plan");
			mkdirSync(planDir, { recursive: true });
			writeFileSync(
				join(planDir, "brief.md"),
				`---\ntitle: "Sample"\ndate: 2026-05-04\nstatus: draft\n---\n\n# Sample\n\nE2E test fixture.\n`,
			);

			// 4. graph sync (2nd run — proves graceful-degrade is idempotent)
			const sync2 = runCli(["graph", "sync"]);
			expect(sync2.code, `2nd graph sync failed: ${sync2.stderr}`).toBe(0);
			expect(sync2.stderr).toMatch(/git mode/i);

			// 5. The semantic graph event log should NOT exist (sync no-oped)
			const logPath = join(projectDir, ".indusk/graph/semantic-graph.log");
			if (existsSync(logPath)) {
				expect(readFileSync(logPath, "utf-8").trim()).toBe("");
			}

			// 6. update — confirms field is preserved + no SCM regression
			const update = runCli(["update"]);
			expect(update.code, `update failed: ${update.stderr}`).toBe(0);
			const configAfter = JSON.parse(
				readFileSync(join(projectDir, ".indusk/config.json"), "utf-8"),
			);
			expect(configAfter.scm).toBe("git");
		});
	},
);
