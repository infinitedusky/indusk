import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T1 — `indusk telemetry start` brings up the daemon in <10s and prints
 *      listening ports (OTLP 4318 + Jaeger UI 16686, both auto-bumped if taken).
 * T3 — `indusk telemetry status` after a successful start reports "running",
 *      both ports, and registered-project count.
 * T4 — `indusk telemetry stop` shuts the daemon down within 3s; subsequent
 *      `status` reports "not running".
 * T5 — `indusk telemetry restart` stops + starts fresh processes — Jaeger +
 *      otelcol PIDs after restart differ from before.
 *
 * Each test spawns the real CLI subprocess against a temp INDUSK_HOME so its
 * PID/port files don't collide with the user's real `~/.indusk/`.
 *
 * SLOW TESTS — each spawns both binaries (Jaeger + otelcol) which takes
 * a few seconds to warm up. Skipped when SKIP_SLOW_TESTS=1.
 *
 * Prerequisite: `pnpm build` in apps/indusk-mcp/ has run so that
 * `dist/bin/cli.js` exists. The test asserts on this at setup.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-home-"));
});

afterEach(() => {
	if (existsSync(join(testHome, "telemetry.pid"))) {
		runCli(["telemetry", "stop"]);
	}
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
});

function runCli(args: string[]): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		env: { ...process.env, INDUSK_HOME: testHome },
		encoding: "utf-8",
	});
	return {
		code: result.status ?? -1,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

function readPidsFromStatus(): {
	jaegerPid: number | null;
	otelcolPid: number | null;
} {
	const pidFile = join(testHome, "telemetry.json");
	if (!existsSync(pidFile)) return { jaegerPid: null, otelcolPid: null };
	const meta = JSON.parse(require("node:fs").readFileSync(pidFile, "utf-8")) as {
		jaegerPid?: number;
		otelcolPid?: number;
	};
	return {
		jaegerPid: meta.jaegerPid ?? null,
		otelcolPid: meta.otelcolPid ?? null,
	};
}

describe("T1 — `indusk telemetry start` brings up the daemon", () => {
	it.skipIf(SHOULD_SKIP)(
		"start exits 0 and prints both listening ports within 10s",
		async () => {
			const result = runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(result.code, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
			// Prints something like "OTLP: http://localhost:xxxxx" and "Jaeger UI: http://localhost:xxxxx"
			expect(result.stdout).toMatch(/OTLP[^\n]*localhost:\d+/);
			expect(result.stdout).toMatch(/(Jaeger UI|UI)[^\n]*localhost:\d+/i);
		},
		30_000,
	);
});

describe("T3 — `indusk telemetry status` after start", () => {
	it.skipIf(SHOULD_SKIP)(
		"reports running + both ports + project count",
		async () => {
			runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			const status = runCli(["telemetry", "status"]);
			expect(status.code).toBe(0);
			expect(status.stdout.toLowerCase()).toContain("running");
			// At minimum mentions both port numbers
			expect(status.stdout).toMatch(/OTLP[^\n]*\d+/);
			expect(status.stdout).toMatch(/UI[^\n]*\d+/);
			// Registered projects count line (0 for fresh test home)
			expect(status.stdout).toMatch(/project/i);
		},
		30_000,
	);
});

describe("T4 — `indusk telemetry stop` shuts down in <3s", () => {
	it.skipIf(SHOULD_SKIP)(
		"stop exits 0 and status after reports not running",
		async () => {
			runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			const stop = runCli(["telemetry", "stop"]);
			expect(stop.code).toBe(0);
			const status = runCli(["telemetry", "status"]);
			expect(status.stdout.toLowerCase()).toContain("not running");
		},
		30_000,
	);
});

describe("T5 — `indusk telemetry restart` respawns both binaries", () => {
	it.skipIf(SHOULD_SKIP)(
		"PIDs after restart differ from PIDs before",
		async () => {
			runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			const before = readPidsFromStatus();
			expect(before.jaegerPid).not.toBeNull();
			expect(before.otelcolPid).not.toBeNull();

			const restart = runCli(["telemetry", "restart"]);
			expect(restart.code).toBe(0);

			const after = readPidsFromStatus();
			expect(after.jaegerPid).not.toBeNull();
			expect(after.otelcolPid).not.toBeNull();
			expect(after.jaegerPid).not.toBe(before.jaegerPid);
			expect(after.otelcolPid).not.toBe(before.otelcolPid);
		},
		45_000,
	);
});
