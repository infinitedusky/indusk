import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * A registered project's `.mcp.json` names the daemon's MCP port, and nothing
 * but registering that project moves it:
 *
 *  - registering writes the project's own `jaeger` entry at the daemon's MCP
 *    port;
 *  - `restart` keeps the address, so every project's file stays byte-for-byte
 *    as it was (a rewrite would make the file look edited);
 *  - `start` leaves another project's stale URL alone: it is that project's
 *    own file, and only that project's `update` or `register` repairs it;
 *  - `update` repairs this project's stale entry.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectA: string;
let projectB: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-sync-home-"));
	projectA = mkdtempSync(join(tmpdir(), "telemetry-syncA-"));
	projectB = mkdtempSync(join(tmpdir(), "telemetry-syncB-"));
});

afterEach(() => {
	if (existsSync(join(testHome, "telemetry.pid"))) {
		spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		});
	}
	for (const dir of [testHome, projectA, projectB]) {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	}
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

function readJaegerUrl(projectPath: string): string | undefined {
	const p = join(projectPath, ".mcp.json");
	if (!existsSync(p)) return undefined;
	const data = JSON.parse(readFileSync(p, "utf-8")) as {
		mcpServers?: Record<string, { url?: string }>;
	};
	return data.mcpServers?.jaeger?.url;
}

function readLiveMcpPort(): number {
	const p = join(testHome, "telemetry.json");
	const meta = JSON.parse(readFileSync(p, "utf-8")) as { mcpPort: number };
	return meta.mcpPort;
}

describe("a registered project's .mcp.json is written only by that project", () => {
	it.skipIf(SHOULD_SKIP)(
		"telemetry restart keeps the address and leaves every entry byte-for-byte unchanged",
		async () => {
			expect(runCli(["telemetry", "register", projectA]).code).toBe(0);
			expect(runCli(["telemetry", "register", projectB]).code).toBe(0);

			const port = readLiveMcpPort();
			expect(readJaegerUrl(projectA)).toBe(`http://localhost:${port}/mcp`);
			expect(readJaegerUrl(projectB)).toBe(`http://localhost:${port}/mcp`);
			const before = [projectA, projectB].map((p) => readFileSync(join(p, ".mcp.json"), "utf-8"));

			const restart = runCli(["telemetry", "restart"]);
			expect(restart.code, restart.stderr).toBe(0);

			expect(readLiveMcpPort(), "the MCP port is the same after a restart").toBe(port);
			expect([projectA, projectB].map((p) => readFileSync(join(p, ".mcp.json"), "utf-8"))).toEqual(
				before,
			);
		},
		90_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"telemetry start leaves another project's stale jaeger url alone",
		async () => {
			expect(runCli(["telemetry", "register", projectA]).code).toBe(0);
			expect(runCli(["telemetry", "stop"]).code).toBe(0);

			// Hand-corrupt the .mcp.json to simulate a port set by someone else.
			const mcpJsonPath = join(projectA, ".mcp.json");
			const data = JSON.parse(readFileSync(mcpJsonPath, "utf-8")) as {
				mcpServers?: Record<string, { type?: string; url?: string }>;
			};
			data.mcpServers ??= {};
			data.mcpServers.jaeger = {
				type: "http",
				url: "http://localhost:1/mcp",
			};
			writeFileSync(mcpJsonPath, JSON.stringify(data, null, 2));
			const stale = readFileSync(mcpJsonPath, "utf-8");

			const start = runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(start.code, start.stderr).toBe(0);

			expect(readFileSync(mcpJsonPath, "utf-8")).toBe(stale);
			expect(readJaegerUrl(projectA)).toBe("http://localhost:1/mcp");
		},
		60_000,
	);

	// `indusk update` is the natural "fix my project" command, so it has to
	// repair a stale jaeger url in this project's `.mcp.json` even when the
	// daemon hasn't been touched. The daemon-lifecycle sync (above) covers
	// the broader machine-state path; this covers per-project recovery.
	it.skipIf(SHOULD_SKIP)(
		"indusk update repairs this project's stale jaeger url when the daemon is running",
		async () => {
			expect(runCli(["telemetry", "register", projectA]).code).toBe(0);

			// Hand-corrupt: stale jaeger entry but daemon still up.
			const mcpJsonPath = join(projectA, ".mcp.json");
			const data = JSON.parse(readFileSync(mcpJsonPath, "utf-8")) as {
				mcpServers?: Record<string, { type?: string; url?: string }>;
			};
			data.mcpServers ??= {};
			data.mcpServers.jaeger = { type: "http", url: "http://localhost:1/mcp" };
			writeFileSync(mcpJsonPath, JSON.stringify(data, null, 2));

			// `indusk update` requires `.indusk/config.json` to mark the dir
			// as an InDusk project. Minimum-viable config is fine for this test.
			const induskDir = join(projectA, ".indusk");
			if (!existsSync(induskDir)) mkdirSync(induskDir, { recursive: true });
			writeFileSync(
				join(induskDir, "config.json"),
				JSON.stringify({ mode: "full", scm: "git" }, null, 2),
			);

			// Run update from inside the project; expect the jaeger url to be
			// repaired to the live mcpPort.
			const update = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectA,
				env: {
					...process.env,
					INDUSK_HOME: testHome,
					INDUSK_SKIP_UPDATE_CHECK: "1",
				},
				encoding: "utf-8",
			});
			expect(update.status, `update failed: ${update.stderr}`).toBe(0);

			const livePort = readLiveMcpPort();
			expect(readJaegerUrl(projectA)).toBe(`http://localhost:${livePort}/mcp`);
		},
		60_000,
	);
});
