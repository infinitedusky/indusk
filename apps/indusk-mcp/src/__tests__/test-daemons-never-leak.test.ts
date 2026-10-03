import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, runCli } from "./helpers/cli.js";
import { stopTelemetryForHome, telemetryProcessesFor } from "./helpers/telemetry-reap.js";

/**
 * test-daemons-never-leak — A1: a test that runs `init` starts no telemetry
 * daemon.
 *
 * `init` enables the required `local-telemetry` extension, whose hook runs
 * `indusk telemetry register`, which started a detached Jaeger + otelcol pair
 * for every temporary home a test made — 860 were found running on
 * 2026-10-03, 2,058 on 2026-08-13. Read from the process list, as they were
 * found, because their only record lives in a home the test deletes.
 */

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) {
		stopTelemetryForHome(dir);
		rmSync(dir, { recursive: true, force: true });
	}
});

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	made.push(dir);
	return dir;
}

function fixtureProject(): string {
	const dir = tempDir("leak-proj-");
	execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
	return dir;
}

describe("A1 — a test that runs init starts no telemetry daemon", () => {
	it("through the CLI helper", () => {
		const home = tempDir("leak-home-");
		const r = runCli(fixtureProject(), ["init", "--force"], { INDUSK_HOME: home });
		expect(r.code, r.stderr).toBe(0);
		expect(
			telemetryProcessesFor(home),
			"init from a test leaves no Jaeger or otelcol behind",
		).toEqual([]);
	});

	it("through a child started with its own environment built on the test process's", () => {
		const home = tempDir("leak-home-");
		const r = spawnSync("node", [CLI_BIN, "init", "--force"], {
			cwd: fixtureProject(),
			encoding: "utf-8",
			env: { ...process.env, INDUSK_HOME: home, INDUSK_SKIP_UPDATE_CHECK: "1" },
		});
		expect(r.status, r.stderr).toBe(0);
		expect(
			telemetryProcessesFor(home),
			"init from a test leaves no Jaeger or otelcol behind",
		).toEqual([]);
	});
});
