import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, SHOULD_SKIP } from "./helpers/cli.js";
import { stopTelemetryForHome, telemetryProcessesFor } from "./helpers/telemetry-reap.js";

/**
 * test-daemons-never-leak — A2, A3. System tier: both start a real daemon on
 * purpose and stop it.
 *
 * A2 guards the opposite mistake to the leak: the switch that keeps tests from
 * starting a daemon must not reach a person running the CLI. A3 is the guard
 * that `pnpm test` ends with — a daemon left running from a temporary home
 * fails the run, by name.
 */

const GUARD = resolve(__dirname, "..", "..", "scripts", "check-test-daemons.js");

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

/** The test process's environment without the switch: what a person's shell has. */
function personEnv(home: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		INDUSK_HOME: home,
		INDUSK_SKIP_UPDATE_CHECK: "1",
	};
	delete env.INDUSK_SKIP_TELEMETRY_AUTOSTART;
	return env;
}

describe.skipIf(SHOULD_SKIP)("A2 — a real register still starts the daemon", () => {
	it("with the switch unset, register starts a pair for a home that has none", () => {
		const home = tempDir("guard-home-");
		const project = tempDir("guard-proj-");
		execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project });
		const r = spawnSync("node", [CLI_BIN, "telemetry", "register", project], {
			encoding: "utf-8",
			env: personEnv(home),
		});
		expect(r.status, r.stderr).toBe(0);
		expect(telemetryProcessesFor(home), "a Jaeger and an otelcol from this home").toHaveLength(2);
	});
});

describe.skipIf(SHOULD_SKIP)("A3 — the guard names a daemon left from a temporary home", () => {
	it("fails naming it while it runs, and stops naming it once stopped", () => {
		const home = tempDir("guard-home-");
		const project = tempDir("guard-proj-");
		execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project });
		// Started the way a leaked one was: register's start, on free ports
		// (`telemetry start` refuses the defaults the real daemon holds).
		const start = spawnSync("node", [CLI_BIN, "telemetry", "register", project], {
			encoding: "utf-8",
			env: personEnv(home),
		});
		expect(start.status, start.stderr).toBe(0);
		expect(telemetryProcessesFor(home)).toHaveLength(2);

		const caught = spawnSync("node", [GUARD], { encoding: "utf-8" });
		expect(caught.status, "a daemon from a temp home fails the guard").not.toBe(0);
		expect(`${caught.stdout}${caught.stderr}`, "and the guard names its home").toContain(home);

		stopTelemetryForHome(home);
		const clear = spawnSync("node", [GUARD], { encoding: "utf-8" });
		expect(`${clear.stdout}${clear.stderr}`, "a stopped daemon is no longer named").not.toContain(
			home,
		);
	});
});
