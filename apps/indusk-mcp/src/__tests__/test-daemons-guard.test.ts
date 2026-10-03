import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

const WRAPPER = resolve(__dirname, "..", "..", "scripts", "with-daemon-guard.js");

describe.skipIf(SHOULD_SKIP)("A4 — a failing run still runs the guard", () => {
	it("exits non-zero and names a daemon left in a temp home, though the tests failed", () => {
		const home = tempDir("guard-home-");
		const project = tempDir("guard-proj-");
		execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project });
		const start = spawnSync("node", [CLI_BIN, "telemetry", "register", project], {
			encoding: "utf-8",
			env: personEnv(home),
		});
		expect(start.status, start.stderr).toBe(0);

		// The "test command" fails, as a crashed or timed-out run does.
		const run = spawnSync("node", [WRAPPER, "node", "-e", "process.exit(3)"], {
			encoding: "utf-8",
		});
		expect(run.status, "a failing run fails").not.toBe(0);
		expect(`${run.stdout}${run.stderr}`, "and the guard still ran, naming the leak").toContain(
			home,
		);
	});
});

describe("A5 — every test entry point ends with the guard", () => {
	it("the root `test` and the package's `test:system` run through the guard wrapper", () => {
		const read = (p: string) =>
			JSON.parse(readFileSync(p, "utf-8")).scripts as Record<string, string>;
		const root = read(resolve(__dirname, "..", "..", "..", "..", "package.json"));
		const pkg = read(resolve(__dirname, "..", "..", "package.json"));
		expect(root.test, "root pnpm test").toMatch(/with-daemon-guard\.js/);
		expect(pkg["test:system"], "pnpm test:system — the tier that starts daemons").toMatch(
			/with-daemon-guard\.js/,
		);
	});
});
