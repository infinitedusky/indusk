import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Escape-hatch contract — if `.indusk/config.json` contains
 * `disabled_extensions: ["local-telemetry"]`, the required-by-default
 * machinery MUST respect it:
 *
 *  - `indusk init` does NOT auto-enable local-telemetry
 *  - `indusk update` does NOT migrate local-telemetry in
 *  - No daemon registration
 *  - No `jaeger` entry in `.mcp.json`
 *
 * This is the documented opt-out for projects that genuinely don't want the
 * extension (e.g., security-constrained environments where a localhost
 * daemon is prohibited, or perf-constrained environments where any local
 * OTel overhead is unacceptable).
 *
 * RED AT PHASE 6 START. Today there's no `disabled_extensions` config key
 * at all; `autoEnableExtensions` doesn't read config.json. Passes once
 * Phase 6 wires the required-resolution path to honor the escape hatch.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-escape-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "telemetry-escape-proj-"));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "telemetry-escape-smoke", version: "0.0.0" }, null, 2),
	);
});

afterEach(() => {
	// Paranoid cleanup — if the daemon got started anyway (contract
	// violation), make sure we don't leak it.
	if (existsSync(join(testHome, "telemetry.pid"))) {
		spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		});
	}
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
});

function runInit(): { code: number; stdout: string; stderr: string } {
	const result = spawnSync("node", [CLI_BIN, "init", "--no-index"], {
		cwd: projectDir,
		env: { ...process.env, INDUSK_HOME: testHome },
		encoding: "utf-8",
		timeout: 60_000,
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

describe("Escape hatch — disabled_extensions silences required-by-default local-telemetry", () => {
	it.skipIf(SHOULD_SKIP)(
		"init with disabled_extensions:['local-telemetry'] does NOT enable, register, or wire MCP",
		async () => {
			// Pre-seed `.indusk/config.json` with the escape-hatch key so
			// `init`'s required-resolution path should respect it.
			mkdirSync(join(projectDir, ".indusk"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify(
					{
						mode: "local",
						disabled_extensions: ["local-telemetry"],
					},
					null,
					2,
				),
			);

			const result = runInit();
			expect(
				result.code,
				`init failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
			).toBe(0);

			// Extension NOT enabled
			expect(
				existsSync(join(projectDir, ".indusk/extensions/local-telemetry/manifest.json")),
				`expected local-telemetry to be skipped due to disabled_extensions\nstdout:\n${result.stdout}`,
			).toBe(false);

			// Registry untouched — project not added
			expect(readRegistry().projects.map((p) => p.path)).not.toContain(projectDir);

			// .mcp.json has no jaeger entry (may not exist at all if init didn't
			// need to write one)
			const mcpPath = join(projectDir, ".mcp.json");
			if (existsSync(mcpPath)) {
				const mcp = JSON.parse(readFileSync(mcpPath, "utf-8")) as {
					mcpServers?: Record<string, unknown>;
				};
				expect(mcp.mcpServers?.jaeger).toBeUndefined();
			}

			// No daemon should have been started
			expect(existsSync(join(testHome, "telemetry.pid"))).toBe(false);

			// init stdout should surface the skip so the user sees it
			expect(result.stdout.toLowerCase()).toMatch(
				/local-telemetry.*(skip|disabled|opted out)|disabled_extensions/,
			);
		},
		90_000,
	);
});
