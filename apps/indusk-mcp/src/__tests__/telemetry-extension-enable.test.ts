import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T6 — Enabling `local-telemetry` on a project registers it with the
 * telemetry daemon, auto-starts the daemon if not running, and subsequent
 * span emission lands in Jaeger.
 *
 * The `local-telemetry` extension's on_enable hook is literally
 * `indusk telemetry register $(pwd)`; this test exercises that subcommand
 * directly against a fresh tmp INDUSK_HOME. Testing the subcommand proves
 * the enable contract without dragging in the full `indusk extensions
 * enable` machinery (which has many other concerns unrelated to the
 * project-registration + daemon-lifecycle story T6 asserts).
 *
 * Post-Phase-4 the extension can be enabled manually via `indusk extensions
 * enable local-telemetry` end-to-end; that path goes through the same
 * on_enable hook and reaches this subcommand.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-ext-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "telemetry-proj-"));
});

afterEach(() => {
	if (existsSync(join(testHome, "telemetry.pid"))) {
		spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		});
	}
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
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

function readRegistry(): { projects: Array<{ name: string; path: string }> } {
	const p = join(testHome, "telemetry", "projects.json");
	if (!existsSync(p)) return { projects: [] };
	return JSON.parse(readFileSync(p, "utf-8"));
}

describe("T6 — local-telemetry extension-enable contract", () => {
	it.skipIf(SHOULD_SKIP)(
		"register auto-starts daemon + records project in registry; deregister stops daemon when empty",
		async () => {
			// Register the project — should trigger daemon auto-start
			const reg = runCli(["telemetry", "register", projectDir]);
			expect(reg.code, `stdout: ${reg.stdout}\nstderr: ${reg.stderr}`).toBe(0);
			expect(reg.stdout).toMatch(/Registered project/);

			// Registry file should contain the project
			const registry = readRegistry();
			expect(registry.projects.length).toBe(1);
			// Registry stores realpath-normalized paths so on_enable's $(pwd)
			// and programmatic register calls match consistently (1.28 change).
			expect(registry.projects[0].path).toBe(realpathSync(projectDir));

			// Daemon should be running (status reports it)
			const status = runCli(["telemetry", "status"]);
			expect(status.stdout.toLowerCase()).toContain("running");
			expect(status.stdout).toMatch(/Registered projects? 1/);

			// Daemon files should exist
			expect(existsSync(join(testHome, "telemetry.pid"))).toBe(true);
			expect(existsSync(join(testHome, "telemetry.json"))).toBe(true);

			// Project's .mcp.json should have a jaeger MCP server entry pointing
			// at the daemon's mcpPort (pattern: the agent talks to Jaeger's
			// bundled MCP tool surface directly through .mcp.json, like dash0)
			const projectMcp = join(projectDir, ".mcp.json");
			expect(existsSync(projectMcp)).toBe(true);
			const mcp = JSON.parse(readFileSync(projectMcp, "utf-8")) as {
				mcpServers?: Record<string, { type?: string; url?: string }>;
			};
			expect(mcp.mcpServers?.jaeger).toBeDefined();
			expect(mcp.mcpServers?.jaeger?.type).toBe("http");
			expect(mcp.mcpServers?.jaeger?.url).toMatch(/^http:\/\/localhost:\d+\/mcp$/);

			// Deregister — should stop the daemon since registry becomes empty
			const dereg = runCli(["telemetry", "deregister", projectDir]);
			expect(dereg.code).toBe(0);
			expect(dereg.stdout).toMatch(/Deregistered project/);
			expect(dereg.stdout).toMatch(/stopping daemon/i);

			// Registry empty + daemon stopped
			expect(readRegistry().projects.length).toBe(0);
			const statusAfter = runCli(["telemetry", "status"]);
			expect(statusAfter.stdout.toLowerCase()).toContain("not running");

			// .mcp.json's jaeger entry should be removed on deregister
			const projectMcpPath = join(projectDir, ".mcp.json");
			if (existsSync(projectMcpPath)) {
				const mcpAfter = JSON.parse(readFileSync(projectMcpPath, "utf-8")) as {
					mcpServers?: Record<string, unknown>;
				};
				expect(mcpAfter.mcpServers?.jaeger).toBeUndefined();
			}
		},
		45_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"two-project lifecycle: daemon stays up while second project registered; stops on last deregister",
		async () => {
			const secondProject = mkdtempSync(join(tmpdir(), "telemetry-proj2-"));
			try {
				runCli(["telemetry", "register", projectDir]);
				runCli(["telemetry", "register", secondProject]);

				expect(readRegistry().projects.length).toBe(2);
				expect(existsSync(join(testHome, "telemetry.pid"))).toBe(true);

				// Deregister first — daemon should stay up (second project still registered)
				runCli(["telemetry", "deregister", projectDir]);
				expect(readRegistry().projects.length).toBe(1);
				expect(existsSync(join(testHome, "telemetry.pid"))).toBe(true);

				// Deregister second — daemon stops
				runCli(["telemetry", "deregister", secondProject]);
				expect(readRegistry().projects.length).toBe(0);
				expect(existsSync(join(testHome, "telemetry.pid"))).toBe(false);
			} finally {
				rmSync(secondProject, { recursive: true, force: true });
			}
		},
		45_000,
	);
});
