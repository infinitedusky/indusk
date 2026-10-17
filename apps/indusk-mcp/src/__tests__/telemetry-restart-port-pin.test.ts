import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression: `indusk telemetry restart` used to call a fixed `sleep(200)`
 * after `daemonStop()`. If the OS hadn't released the port within 200ms
 * (common on macOS), the daemon drifted off its pinned port — breaking every
 * downstream app pointed at the old one. `daemonRestart` polls each port with a
 * 5s timeout, and now covers all four (traces, logs, interface, MCP).
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-restart-pin-home-"));
});

afterEach(() => {
	if (existsSync(join(testHome, "telemetry.pid"))) {
		spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		});
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

function readPorts(): number[] {
	const meta = JSON.parse(readFileSync(join(testHome, "telemetry.json"), "utf-8")) as {
		otlpPort: number;
		logsOtlpPort: number;
		uiPort: number;
		mcpPort: number;
	};
	return [meta.otlpPort, meta.logsOtlpPort, meta.uiPort, meta.mcpPort];
}

describe("telemetry restart keeps all four ports across the OS port-release race", () => {
	it.skipIf(SHOULD_SKIP)(
		"the traces, logs, interface and MCP ports stay identical across two back-to-back restarts",
		{ timeout: 90_000 },
		async () => {
			// A temporary home takes the ports it is given: any free ones here.
			const start = runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(start.code, start.stderr).toBe(0);
			const pinned = readPorts();
			expect(pinned.every((p) => p > 0)).toBe(true);

			const restart1 = runCli(["telemetry", "restart"]);
			expect(restart1.code, restart1.stderr).toBe(0);
			expect(readPorts()).toEqual(pinned);

			const restart2 = runCli(["telemetry", "restart"]);
			expect(restart2.code, restart2.stderr).toBe(0);
			expect(readPorts()).toEqual(pinned);
		},
	);
});
