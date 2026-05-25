import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression: `indusk telemetry restart` used to call a fixed `sleep(200)`
 * after `daemonStop()`, then `findFreePort(inheritedOpts.otlpPort)`. If the
 * OS hadn't released the port within 200ms (common on macOS), findFreePort
 * fell through to `pickAnyFreePort()` and drifted the OTLP port off the
 * user's pinned value — breaking every downstream app pointed at the old
 * port. Now `daemonRestart` polls `isPortFree` with a 5s timeout.
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

function readOtlpPort(): number {
	const meta = JSON.parse(
		readFileSync(join(testHome, "telemetry.json"), "utf-8"),
	) as { otlpPort: number };
	return meta.otlpPort;
}

describe("telemetry restart pins the OTLP port across the OS port-release race", () => {
	it.skipIf(SHOULD_SKIP)(
		"otlpPort stays identical across two back-to-back restarts",
		{ timeout: 90_000 },
		async () => {
			// Start with auto-pick so we don't collide with the user's daemon on 4318
			const start = runCli([
				"telemetry",
				"start",
				"--otlp-port",
				"0",
				"--ui-port",
				"0",
			]);
			expect(start.code, start.stderr).toBe(0);
			const pinnedPort = readOtlpPort();
			expect(pinnedPort).toBeGreaterThan(0);

			const restart1 = runCli(["telemetry", "restart"]);
			expect(restart1.code, restart1.stderr).toBe(0);
			expect(readOtlpPort()).toBe(pinnedPort);

			const restart2 = runCli(["telemetry", "restart"]);
			expect(restart2.code, restart2.stderr).toBe(0);
			expect(readOtlpPort()).toBe(pinnedPort);
		},
	);
});
