import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T18 — `indusk init` on a fresh project auto-enables `local-telemetry`
 * (required-by-default), registers the project with the telemetry daemon,
 * writes a `jaeger` MCP server entry to `.mcp.json`, and starts the daemon.
 * Zero further manual config — the user types `indusk init` and local OTel
 * works on the next `pnpm dev`.
 *
 * RED AT PHASE 6 START. Passes once required:true resolution + init's
 * auto-enable path land in Phase 6 impl. Today `autoEnableExtensions` only
 * consults `detect.*` heuristics and ignores `required: true`, so fresh
 * init does NOT enable local-telemetry.
 *
 * We build a minimal fake-project (empty `package.json`, no other tooling
 * signals) so detection heuristics don't accidentally enable it. Then `init`
 * must still enable it via the required-resolution path.
 *
 * Runs against the built CLI (`dist/bin/cli.js`) with INDUSK_HOME pointed
 * at a tmpdir so we don't touch the real ~/.indusk.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-init-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "telemetry-init-proj-"));
	// Minimal fake project — no framework signals; only a package.json so
	// `init` finds a plausible project shape without tripping NextJS/React/Python
	// OTel scaffolding (which isn't the concern of this test).
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "telemetry-init-smoke", version: "0.0.0" }, null, 2),
	);
});

afterEach(() => {
	// Best-effort daemon stop — if init auto-started it, we don't want to
	// leak the process across tests.
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

function runInit(): { code: number; stdout: string; stderr: string } {
	const result = spawnSync(
		"node",
		[CLI_BIN, "init", "--no-index"],
		{
			cwd: projectDir,
			env: {
				...process.env,
				INDUSK_HOME: testHome,
				// Force the on_enable hook ("indusk telemetry register $(pwd)")
				// to use our dev CLI instead of the globally-installed indusk
				// (which may be a pre-1.28 version without the telemetry subcommand).
				INDUSK_BIN: `node ${CLI_BIN}`,
			},
			encoding: "utf-8",
			timeout: 60_000,
		},
	);
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

describe("T18 — indusk init auto-enables local-telemetry (required-by-default)", () => {
	it.skipIf(SHOULD_SKIP)(
		"fresh init enables local-telemetry without any flag, registers the project, wires .mcp.json, starts daemon",
		async () => {
			const result = runInit();
			expect(
				result.code,
				`init failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
			).toBe(0);

			// Extension was auto-enabled
			const enabledManifest = join(
				projectDir,
				".indusk/extensions/local-telemetry/manifest.json",
			);
			expect(existsSync(enabledManifest)).toBe(true);
			const manifest = JSON.parse(readFileSync(enabledManifest, "utf-8")) as {
				name: string;
				required?: boolean;
			};
			expect(manifest.name).toBe("local-telemetry");
			expect(manifest.required).toBe(true);

			// init stdout advertises the auto-enable (user-visible feedback)
			expect(result.stdout.toLowerCase()).toMatch(/local-telemetry/);

			// Registry updated. Realpath both sides — macOS mkdtemp returns a
			// `/var/...` path but the CLI's cwd resolves via `$(pwd)` which
			// expands to the realpath `/private/var/...`.
			const registry = readRegistry();
			const resolvedProject = realpathSync(projectDir);
			expect(
				registry.projects.map((p) => realpathSync(p.path)),
			).toContain(resolvedProject);

			// .mcp.json has a jaeger MCP server entry
			const mcp = JSON.parse(
				readFileSync(join(projectDir, ".mcp.json"), "utf-8"),
			) as {
				mcpServers?: Record<string, { type?: string; url?: string }>;
			};
			expect(mcp.mcpServers?.jaeger).toBeDefined();
			expect(mcp.mcpServers?.jaeger?.type).toBe("http");
			expect(mcp.mcpServers?.jaeger?.url).toMatch(
				/^http:\/\/localhost:\d+\/mcp$/,
			);

			// Daemon should be running after init
			expect(existsSync(join(testHome, "telemetry.pid"))).toBe(true);
			expect(existsSync(join(testHome, "telemetry.json"))).toBe(true);
		},
		90_000,
	);
});
