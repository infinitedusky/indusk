import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Verifies the `.env.example` copy + missing-`.env` hint path introduced
 * in 1.28.3. The contract is:
 *
 *   - Enabling any extension that ships an `.env.example` in its built-in
 *     source dir results in the file landing at
 *     `.indusk/extensions/{name}/.env.example` in the project.
 *   - When the project has no real `.env`, the enable output nudges the
 *     user with a literal `cp` command.
 *   - Subsequent enables (already-enabled re-runs during `indusk update`)
 *     still refresh `.env.example` so field-doc updates propagate.
 *   - Auth-requiring extensions (dash0) still refuse to fully enable
 *     without credentials, but the example file lands anyway so the
 *     user has a concrete template to edit.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

let projectDir: string;

beforeEach(() => {
	projectDir = mkdtempSync(join(tmpdir(), "ext-env-example-"));
	// Minimal project shape so CLI commands don't complain about missing
	// .indusk scaffolding. We only need the extensions directory to exist;
	// the `extensions enable` subcommand creates its own structure.
	mkdirSync(join(projectDir, ".indusk"), { recursive: true });
	writeFileSync(
		join(projectDir, ".indusk/config.json"),
		JSON.stringify({ mode: "normal", otel: { role: "none" } }),
	);
});

afterEach(() => {
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
});

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
		encoding: "utf-8",
	});
	return {
		code: result.status ?? -1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

describe(".env.example copy + missing-.env hint", () => {
	it.skipIf(SHOULD_SKIP)(
		"dash0 enable lands .env.example even when credentials are missing, and points the user at a cp command",
		() => {
			const result = runCli(["extensions", "enable", "dash0"]);

			const examplePath = join(projectDir, ".indusk/extensions/dash0/.env.example");
			expect(existsSync(examplePath), `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(
				true,
			);

			const contents = readFileSync(examplePath, "utf-8");
			// Read-side keys stay — these configure how indusk-mcp queries Dash0.
			expect(contents).toMatch(/DASH0_AUTH_TOKEN/);
			expect(contents).toMatch(/DASH0_DATASET/);
			expect(contents).toMatch(/DASH0_ENDPOINT_MCP/);
			// Write-side keys are gone (1.28.5) — service emit is not the dash0
			// extension's concern. Fail loudly if they sneak back in.
			expect(contents).not.toMatch(/^OTEL_EXPORTER_OTLP_ENDPOINT=/m);
			expect(contents).not.toMatch(/^OTEL_EXPORTER_OTLP_HEADERS=/m);

			expect(result.stdout).toMatch(/cannot enable/);
			expect(result.stdout).toMatch(
				/cp \.indusk\/extensions\/dash0\/\.env\.example \.indusk\/extensions\/dash0\/\.env/,
			);
		},
		30_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"re-running enable on an already-enabled extension refreshes .env.example from source",
		() => {
			// Seed: first enable lands the example.
			runCli(["extensions", "enable", "dash0"]);
			const examplePath = join(projectDir, ".indusk/extensions/dash0/.env.example");
			expect(existsSync(examplePath)).toBe(true);

			// Simulate drift: user hand-edited or a stale version is on disk.
			writeFileSync(examplePath, "STALE_CONTENT=1\n");
			expect(readFileSync(examplePath, "utf-8")).toBe("STALE_CONTENT=1\n");

			// Re-enable should refresh the example from source (overwrite drift).
			const result = runCli(["extensions", "enable", "dash0"]);
			expect(result.stdout).toMatch(/already enabled|cannot enable/);

			const refreshed = readFileSync(examplePath, "utf-8");
			expect(refreshed).not.toBe("STALE_CONTENT=1\n");
			expect(refreshed).toMatch(/DASH0_AUTH_TOKEN/);
		},
		30_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"hint is silent when .env already exists",
		() => {
			// Pre-seed the extension config dir with a fake `.env` so the
			// hint branch should NOT fire.
			const extDir = join(projectDir, ".indusk/extensions/dash0");
			mkdirSync(extDir, { recursive: true });
			writeFileSync(join(extDir, ".env"), "DASH0_AUTH_TOKEN=fake\n");

			const result = runCli(["extensions", "enable", "dash0"]);

			// The cp hint should not be printed because .env exists.
			expect(result.stdout).not.toMatch(/cp \.indusk\/extensions\/dash0\/\.env\.example/);
		},
		30_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"local-telemetry ships an .env.example that documents its OTLP endpoints",
		() => {
			// Smoke: just confirm the source file exists and contains the
			// documented variables. A full enable of local-telemetry would
			// trigger the daemon — out of scope for this test.
			const source = join(REPO_ROOT, "apps/indusk-mcp/extensions/local-telemetry/.env.example");
			expect(existsSync(source)).toBe(true);
			const contents = readFileSync(source, "utf-8");
			expect(contents).toMatch(/OTEL_EXPORTER_OTLP_ENDPOINT/);
			expect(contents).toMatch(/OTEL_EXPORTER_OTLP_LOGS_ENDPOINT/);
		},
	);
});

/**
 * The 1.28.5 hint gate: only extensions that functionally consume `.env`
 * (auth-required MCP servers) trigger the "cp the template to activate"
 * message. Reference-only templates (local-telemetry's port docs) stay
 * silent. Tested by importing the helper directly rather than driving the
 * CLI end-to-end.
 */
describe("envIsFunctional gate", () => {
	it("returns true for dash0 (auth-required MCP server)", async () => {
		const { envIsFunctional } = await import("../bin/commands/extensions.js");
		expect(envIsFunctional("dash0")).toBe(true);
	});

	it("returns false for local-telemetry (no MCP server on the manifest)", async () => {
		const { envIsFunctional } = await import("../bin/commands/extensions.js");
		expect(envIsFunctional("local-telemetry")).toBe(false);
	});

	it("returns false for extensions that don't exist", async () => {
		const { envIsFunctional } = await import("../bin/commands/extensions.js");
		expect(envIsFunctional("not-a-real-extension-xyz")).toBe(false);
	});
});
