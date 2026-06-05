import { spawnSync } from "node:child_process";
import {
	chmodSync,
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
 * Test Trajectory for the doppler-extension plan.
 *
 * T1 is live (Phase 1): enabling the doppler extension lands its `.env.example`
 * documenting the InDusk-level service token.
 *
 * T2–T7 are `.skip()` scaffolds carrying their intended assertions; each names
 * the phase that unblocks it. The work skill un-skips them as their phases land:
 *   T2/T7 → Phase 2 (env-pull)   T3 → Phase 3 (worktree auto-provision)
 *   T4/T5/T6 → Phase 4 (init/update posture)
 * T8/T9 are manual smokes (Phase 5) and live in the impl, not here.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

let projectDir: string;

beforeEach(() => {
	projectDir = mkdtempSync(join(tmpdir(), "doppler-ext-"));
	mkdirSync(join(projectDir, ".indusk"), { recursive: true });
	writeFileSync(
		join(projectDir, ".indusk/config.json"),
		JSON.stringify({ mode: "normal", otel: { role: "none" } }),
	);
});

afterEach(() => {
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
});

function runCli(args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1", ...extraEnv },
		encoding: "utf-8",
	});
	return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/**
 * Stub `doppler` binary. Writes a fake executable into a temp bin dir that
 * answers `doppler secrets download --config <cfg> --format env` by printing
 * the fixture env block for that config. Returns the PATH-prefixed env to pass
 * to runCli. Used by T2+ once env-pull exists; T1 needs no Doppler call.
 *
 * Keep the fixture honest against a real `doppler secrets download --format env`
 * sample (KEY=value lines) so the manual smokes (T8/T9) catch drift.
 */
function stubDoppler(configs: Record<string, Record<string, string>>): NodeJS.ProcessEnv {
	const binDir = mkdtempSync(join(tmpdir(), "doppler-stub-"));
	const shim = `#!/usr/bin/env node
const args = process.argv.slice(2);
const ci = args.indexOf("--config");
const cfg = ci >= 0 ? args[ci + 1] : "";
const configs = ${JSON.stringify(configs)};
const block = configs[cfg] || {};
process.stdout.write(Object.entries(block).map(([k, v]) => k + "=" + v).join("\\n") + "\\n");
`;
	const binPath = join(binDir, "doppler");
	writeFileSync(binPath, shim);
	chmodSync(binPath, 0o755);
	return { PATH: `${binDir}:${process.env.PATH ?? ""}` };
}

describe("doppler extension — Test Trajectory", () => {
	// T1 — Passes at Phase 1 (live)
	it.skipIf(SHOULD_SKIP)(
		"T1: enabling the doppler extension lands .env.example documenting the token + config",
		() => {
			const r = runCli(["extensions", "enable", "doppler"]);
			const example = join(projectDir, ".indusk/extensions/doppler/.env.example");
			expect(existsSync(example), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(true);
			const contents = readFileSync(example, "utf-8");
			expect(contents).toMatch(/DOPPLER_TOKEN/);
			expect(contents).toMatch(/DOPPLER_PROJECT/);
		},
		30_000,
	);

	// T2 — Passes at Phase 2 (env-pull).
	it.skipIf(SHOULD_SKIP)(
		"T2: env-pull writes apps/<app>/.env.<profile> from (stubbed) Doppler",
		() => {
			mkdirSync(join(projectDir, "apps/admin"), { recursive: true });
			mkdirSync(join(projectDir, ".indusk/extensions/doppler"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/extensions/doppler/.env"),
				"DOPPLER_TOKEN=t\nDOPPLER_PROJECT=demo\n",
			);
			const env = stubDoppler({ loc_admin: { DATABASE_URL: "postgres://local", PORT: "3000" } });
			const r = runCli(["doppler", "env-pull", "local"], env);
			const out = join(projectDir, "apps/admin/.env.local");
			expect(existsSync(out), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(true);
			const dotenv = readFileSync(out, "utf-8");
			expect(dotenv).toMatch(/DATABASE_URL=postgres:\/\/local/);
			expect(dotenv).toMatch(/PORT=3000/);
		},
		30_000,
	);

	// T7 — Passes at Phase 2 (gitignore). Provisioned env files never show in git status.
	it.skipIf(SHOULD_SKIP)(
		"T7: provisioned .env.<profile> files are gitignored",
		() => {
			spawnSync("git", ["init", "-q"], { cwd: projectDir });
			mkdirSync(join(projectDir, "apps/admin"), { recursive: true });
			mkdirSync(join(projectDir, ".indusk/extensions/doppler"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/extensions/doppler/.env"),
				"DOPPLER_TOKEN=t\nDOPPLER_PROJECT=demo\n",
			);
			const env = stubDoppler({ loc_admin: { SECRET: "x" } });
			runCli(["doppler", "env-pull", "local"], env);
			expect(existsSync(join(projectDir, "apps/admin/.env.local"))).toBe(true);
			const status =
				spawnSync("git", ["status", "--porcelain", "-uall"], {
					cwd: projectDir,
					encoding: "utf-8",
				}).stdout ?? "";
			// the provisioned env file and the InDusk-level token are both gitignored
			expect(status).not.toMatch(/apps\/admin\/\.env\.local/);
			expect(status).not.toMatch(/extensions\/doppler\/\.env$/m);
		},
		30_000,
	);

	// T3 — Passes at Phase 3 (worktree auto-provision). THE load-bearing assertion.
	it.skip("T3: indusk worktree create auto-provisions a build-ready worktree (no manual env step)", () => {
		// In a workbench with the doppler extension enabled + token present,
		// `indusk worktree create <slug>` against stubDoppler() yields a worktree
		// whose apps have populated .env files, with zero manual steps.
		expect(true).toBe(true);
	});

	// T4 — Passes at Phase 4 (init posture).
	it.skip("T4: a fresh indusk init enables doppler and creates no composable.env env/ tree", () => {
		// `indusk init` → .indusk/extensions/doppler enabled; no top-level env/ contract dir.
		expect(true).toBe(true);
	});

	// T5 — Passes at Phase 4 (update deprecation, non-destructive).
	it.skip("T5: indusk update on a composable.env project reports ce deprecation + migration path, ce still works", () => {
		expect(true).toBe(true);
	});

	// T6 — Passes at Phase 4 (ce opt-in regression guard).
	it.skip("T6: the composable-env extension can still be explicitly enabled (opt-in)", () => {
		const r = runCli(["extensions", "enable", "composable-env"]);
		expect(r.stdout).toMatch(/composable-env: enabled|already enabled/);
	});
});
