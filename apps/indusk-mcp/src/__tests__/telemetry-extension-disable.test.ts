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
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T19 — `indusk extensions disable local-telemetry` exercises the FULL CLI
 * chain through the extension's `on_disable` hook: deregisters the project,
 * removes the `jaeger` MCP server entry from `.mcp.json`, and stops the
 * daemon iff the registry becomes empty. No orphan processes; no stale
 * `.mcp.json` entries.
 *
 * WHY A SEPARATE TEST FROM T6: T6 (telemetry-extension-enable.test.ts)
 * invokes `indusk telemetry register/deregister` directly — it bypasses the
 * extension manifest + on_enable/on_disable hook chain. T19 hits the full
 * shape a user actually triggers: `indusk extensions disable X` →
 * extensionsDisable reads the manifest → runs the on_disable hook (a shell
 * command like `indusk telemetry deregister $(pwd)`) → dereg cleans up.
 *
 * RED AT PHASE 6 START. Today `extensionsDisable` in
 * `apps/indusk-mcp/src/bin/commands/extensions.ts` at line 175 does NOT run
 * the on_disable hook — it only renames the manifest directory. So the user
 * sees the extension go dark but the daemon keeps running, the project
 * stays in the registry, and `.mcp.json`'s jaeger entry goes stale. Passes
 * once Phase 6 wires the on_disable hook through extensionsDisable
 * (mirroring how extensionsEnable runs on_init).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const PACKAGE_ROOT = join(REPO_ROOT, "apps/indusk-mcp");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-disable-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "telemetry-disable-proj-"));

	// Minimal project shape so CLI commands that walk up to find .indusk/config.json
	// succeed: create .indusk/config.json at the project root.
	mkdirSync(join(projectDir, ".indusk"), { recursive: true });
	writeFileSync(
		join(projectDir, ".indusk/config.json"),
		JSON.stringify({ mode: "local" }, null, 2),
	);

	// Seed the local-telemetry extension manifest into the project's
	// enabled-extensions dir — as if `extensions enable local-telemetry` had
	// already run. We also register the project directly so the
	// disable-flow's on_disable hook has something to deregister.
	const extDir = join(projectDir, ".indusk/extensions/local-telemetry");
	mkdirSync(extDir, { recursive: true });
	const builtinManifest = join(
		PACKAGE_ROOT,
		"extensions/local-telemetry/manifest.json",
	);
	if (!existsSync(builtinManifest)) {
		throw new Error(
			`Built-in local-telemetry manifest not found at ${builtinManifest}`,
		);
	}
	writeFileSync(
		join(extDir, "manifest.json"),
		readFileSync(builtinManifest, "utf-8"),
	);

	// Register the project so the daemon is running + .mcp.json has the
	// jaeger entry — preconditions for meaningful disable assertions.
	const reg = spawnSync(
		"node",
		[CLI_BIN, "telemetry", "register", projectDir],
		{
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		},
	);
	if (reg.status !== 0) {
		throw new Error(
			`precondition register failed: code=${reg.status}\nstdout:${reg.stdout}\nstderr:${reg.stderr}`,
		);
	}
});

afterEach(() => {
	if (existsSync(join(testHome, "telemetry.pid"))) {
		spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		});
	}
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(projectDir))
		rmSync(projectDir, { recursive: true, force: true });
});

function runCli(
	args: string[],
	opts: { cwd?: string } = {},
): { code: number; stdout: string; stderr: string } {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: opts.cwd ?? projectDir,
		env: { ...process.env, INDUSK_HOME: testHome },
		encoding: "utf-8",
	});
	return {
		code: result.status ?? -1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function readRegistry(): { projects: Array<{ name: string; path: string }> } {
	const p = join(testHome, "telemetry", "projects.json");
	if (!existsSync(p)) return { projects: [] };
	return JSON.parse(readFileSync(p, "utf-8"));
}

describe("T19 — extensions disable local-telemetry runs on_disable end-to-end", () => {
	it.skipIf(SHOULD_SKIP)(
		"full CLI chain: extensions disable → on_disable hook → deregister + .mcp.json cleanup + daemon stop",
		async () => {
			// Precondition sanity: before disable, registry has this project,
			// .mcp.json has jaeger, daemon is up.
			expect(readRegistry().projects.length).toBe(1);
			const mcpPath = join(projectDir, ".mcp.json");
			expect(existsSync(mcpPath)).toBe(true);
			const mcpBefore = JSON.parse(readFileSync(mcpPath, "utf-8")) as {
				mcpServers?: Record<string, unknown>;
			};
			expect(mcpBefore.mcpServers?.jaeger).toBeDefined();
			expect(existsSync(join(testHome, "telemetry.pid"))).toBe(true);

			// Run the user-facing CLI chain
			const res = runCli(["extensions", "disable", "local-telemetry"]);
			expect(
				res.code,
				`stdout:${res.stdout}\nstderr:${res.stderr}`,
			).toBe(0);
			expect(res.stdout.toLowerCase()).toMatch(/disabled/);

			// Extension was moved to disabled
			expect(
				existsSync(
					join(projectDir, ".indusk/extensions/local-telemetry/manifest.json"),
				),
			).toBe(false);
			expect(
				existsSync(
					join(projectDir, ".indusk/disabled/local-telemetry/manifest.json"),
				),
			).toBe(true);

			// Registry should no longer contain this project
			expect(readRegistry().projects.length).toBe(0);

			// .mcp.json should have had the jaeger entry removed
			const mcpAfter = JSON.parse(readFileSync(mcpPath, "utf-8")) as {
				mcpServers?: Record<string, unknown>;
			};
			expect(mcpAfter.mcpServers?.jaeger).toBeUndefined();

			// Daemon should be stopped (last registered project disabled)
			expect(existsSync(join(testHome, "telemetry.pid"))).toBe(false);
			const status = runCli(["telemetry", "status"]);
			expect(status.stdout.toLowerCase()).toMatch(/not running/);
		},
		60_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"two-project case: disable on one project keeps daemon up for the other",
		async () => {
			const secondProject = mkdtempSync(
				join(tmpdir(), "telemetry-disable-proj2-"),
			);
			try {
				// Seed the second project + register it
				mkdirSync(join(secondProject, ".indusk"), { recursive: true });
				writeFileSync(
					join(secondProject, ".indusk/config.json"),
					JSON.stringify({ mode: "local" }, null, 2),
				);
				const extDir = join(
					secondProject,
					".indusk/extensions/local-telemetry",
				);
				mkdirSync(extDir, { recursive: true });
				writeFileSync(
					join(extDir, "manifest.json"),
					readFileSync(
						join(PACKAGE_ROOT, "extensions/local-telemetry/manifest.json"),
						"utf-8",
					),
				);
				spawnSync(
					"node",
					[CLI_BIN, "telemetry", "register", secondProject],
					{
						env: { ...process.env, INDUSK_HOME: testHome },
						encoding: "utf-8",
					},
				);

				expect(readRegistry().projects.length).toBe(2);

				// Disable on the FIRST project only
				const res = runCli(["extensions", "disable", "local-telemetry"], {
					cwd: projectDir,
				});
				expect(res.code).toBe(0);

				// Registry should drop to 1 (second project still registered)
				expect(readRegistry().projects.length).toBe(1);
				// Daemon should still be running
				expect(existsSync(join(testHome, "telemetry.pid"))).toBe(true);
			} finally {
				if (existsSync(secondProject))
					rmSync(secondProject, { recursive: true, force: true });
			}
		},
		60_000,
	);
});
