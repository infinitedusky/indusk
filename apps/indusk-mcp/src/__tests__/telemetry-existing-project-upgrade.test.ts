import { spawnSync } from "node:child_process";
import { type BinaryLike, createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
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
 * T20 — An existing pre-1.28 project (already using the `dash0` extension,
 * already has an `instrumentation.ts`) can opt into local-telemetry simply by
 * running `indusk update`. The migration step:
 *
 *  1. Auto-enables `local-telemetry` (because `required: true` in its
 *     manifest, and the project hasn't explicitly disabled it).
 *  2. Registers the project with the daemon (daemon auto-starts).
 *  3. Upserts the `jaeger` server entry in `.mcp.json`.
 *  4. LEAVES `instrumentation.ts` UNCHANGED — the env file swap is the only
 *     behavioral change. The SDK reads the endpoint from env at boot.
 *  5. Does NOT remove or alter the `dash0` extension — both extensions
 *     coexist; profile selection picks the endpoint at runtime.
 *
 * RED AT PHASE 6 START. Today `update.ts` syncs skills / lessons / hooks
 * but never touches extensions, so an existing project never receives
 * local-telemetry via `indusk update`. Passes once Phase 6's update.ts
 * migration path runs the required-resolution through update.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const PACKAGE_ROOT = join(REPO_ROOT, "apps/indusk-mcp");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

function sha(data: BinaryLike): string {
	return createHash("sha256").update(data).digest("hex");
}

let testHome: string;
let projectDir: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-upgrade-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "telemetry-upgrade-proj-"));

	// Simulate a pre-1.28 project:
	//   - .indusk/config.json (InDusk-initialized)
	//   - dash0 extension present + enabled
	//   - instrumentation.ts at root (OTel SDK wiring)
	//   - NO local-telemetry extension anywhere (disabled or enabled)
	mkdirSync(join(projectDir, ".indusk"), { recursive: true });
	writeFileSync(
		join(projectDir, ".indusk/config.json"),
		JSON.stringify({ mode: "local" }, null, 2),
	);

	const dash0Dir = join(projectDir, ".indusk/extensions/dash0");
	mkdirSync(dash0Dir, { recursive: true });
	const dash0Builtin = join(PACKAGE_ROOT, "extensions/dash0/manifest.json");
	if (existsSync(dash0Builtin)) {
		writeFileSync(join(dash0Dir, "manifest.json"), readFileSync(dash0Builtin, "utf-8"));
	} else {
		// Stand-in manifest if the real one isn't present in this tree
		writeFileSync(
			join(dash0Dir, "manifest.json"),
			JSON.stringify({ name: "dash0", version: "1.0.0", provides: ["otel-endpoint"] }, null, 2),
		);
	}

	writeFileSync(
		join(projectDir, "instrumentation.ts"),
		[
			"// Simulated pre-1.28 OTel instrumentation. Must NOT be mutated by update.",
			'import { registerOTel } from "@vercel/otel";',
			'registerOTel({ serviceName: "upgrade-test" });',
			"",
		].join("\n"),
	);
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "upgrade-test", version: "0.0.0" }, null, 2),
	);
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

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: {
			...process.env,
			INDUSK_HOME: testHome,
			// Skip the self-update step (npm check) — that's orthogonal to the
			// migration concern we're testing and adds flakiness on offline runs.
			INDUSK_SKIP_SELF_UPDATE: "1",
			// Point the on_enable hook at our dev CLI — the globally-installed
			// indusk may be pre-1.28 without the telemetry subcommand.
			INDUSK_BIN: `node ${CLI_BIN}`,
		},
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

describe("T20 — indusk update migrates pre-1.28 projects to local-telemetry", () => {
	it.skipIf(SHOULD_SKIP)(
		"adds local-telemetry, registers project, wires .mcp.json, leaves instrumentation.ts + dash0 untouched",
		async () => {
			const instrPath = join(projectDir, "instrumentation.ts");
			const instrBefore = sha(readFileSync(instrPath));

			const res = runCli(["update"]);
			expect(res.code, `update failed.\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`).toBe(0);

			// local-telemetry is now enabled
			expect(
				existsSync(join(projectDir, ".indusk/extensions/local-telemetry/manifest.json")),
				`expected local-telemetry to be enabled after update\nstdout:\n${res.stdout}`,
			).toBe(true);

			// dash0 is still enabled (coexistence, not replacement)
			expect(existsSync(join(projectDir, ".indusk/extensions/dash0/manifest.json"))).toBe(true);

			// instrumentation.ts was not modified
			const instrAfter = sha(readFileSync(instrPath));
			expect(instrAfter).toBe(instrBefore);

			// Registry has this project (realpath-normalized — the on_enable hook
			// uses `$(pwd)` which resolves symlinks; registry stores realpaths).
			const resolvedProject = realpathSync(projectDir);
			expect(readRegistry().projects.map((p) => realpathSync(p.path))).toContain(resolvedProject);

			// .mcp.json has jaeger entry wired
			expect(
				existsSync(join(projectDir, ".mcp.json")),
				`expected .mcp.json to be written by the on_enable hook.\nupdate stdout:\n${res.stdout}\nupdate stderr:\n${res.stderr}`,
			).toBe(true);
			const mcp = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf-8")) as {
				mcpServers?: Record<string, { type?: string; url?: string }>;
			};
			expect(mcp.mcpServers?.jaeger).toBeDefined();
			expect(mcp.mcpServers?.jaeger?.type).toBe("http");
			expect(mcp.mcpServers?.jaeger?.url).toMatch(/^http:\/\/localhost:\d+\/mcp$/);

			// update's stdout visibly announced the migration
			expect(res.stdout.toLowerCase()).toMatch(/local-telemetry/);
		},
		90_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"second update is a no-op (idempotent) — doesn't re-register, doesn't duplicate entries",
		async () => {
			const first = runCli(["update"]);
			expect(first.code).toBe(0);
			expect(
				readRegistry().projects.length,
				`after first update: registry=${JSON.stringify(readRegistry())}\nstdout:\n${first.stdout}\nstderr:\n${first.stderr}`,
			).toBe(1);

			const second = runCli(["update"]);
			expect(
				second.code,
				`second update failed.\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`,
			).toBe(0);

			// Still exactly 1 project registered — not 2
			expect(readRegistry().projects.length).toBe(1);
		},
		90_000,
	);
});
