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
import { buildWorktreeFixture } from "./helpers/worktree-fixture.js";

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
	it.skipIf(SHOULD_SKIP)(
		"T3: indusk worktree create auto-provisions a build-ready worktree (no manual env step)",
		() => {
			const fx = buildWorktreeFixture({
				worktreeConfig: { trunk_branch: "main", base_branch: "main" },
				extraFiles: [{ path: "apps/admin/package.json", content: '{"name":"admin"}\n' }],
			});
			try {
				// doppler configured once at the workbench level (shared by every worktree)
				mkdirSync(join(fx.workbenchDir, ".indusk/extensions/doppler"), { recursive: true });
				writeFileSync(
					join(fx.workbenchDir, ".indusk/extensions/doppler/.env"),
					"DOPPLER_TOKEN=t\nDOPPLER_PROJECT=demo\n",
				);
				const env = stubDoppler({ loc_admin: { DATABASE_URL: "postgres://wt", PORT: "4000" } });
				// run `indusk worktree create` FROM the workbench (no manual env step)
				const r = spawnSync("node", [CLI_BIN, "worktree", "create", "feat-x"], {
					cwd: fx.workbenchDir,
					env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1", ...env },
					encoding: "utf-8",
				});
				const provisioned = join(fx.workbenchDir, "feat-x/apps/admin/.env.local");
				expect(existsSync(provisioned), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(true);
				const contents = readFileSync(provisioned, "utf-8");
				expect(contents).toMatch(/DATABASE_URL=postgres:\/\/wt/);
				expect(contents).toMatch(/PORT=4000/);
			} finally {
				fx.cleanup();
			}
		},
		60_000,
	);

	// T4 — Passes at Phase 4. doppler is required:true, so autoEnableExtensions
	// (what init/update call) enables it by default. local-telemetry is disabled
	// here only to isolate doppler from its daemon-starting on_enable hook.
	it.skipIf(SHOULD_SKIP)(
		"T4: a fresh project enables doppler by default and gets no composable.env env/ tree",
		async () => {
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({
					mode: "normal",
					otel: { role: "none" },
					disabled_extensions: ["local-telemetry"],
				}),
			);
			const { autoEnableExtensions } = await import("../bin/commands/extensions.js");
			await autoEnableExtensions(projectDir);
			expect(existsSync(join(projectDir, ".indusk/extensions/doppler"))).toBe(true);
			// composable.env contract tree is never scaffolded
			expect(existsSync(join(projectDir, "env"))).toBe(false);
		},
		30_000,
	);

	// T5 — Passes at Phase 4. The ce deprecation notice (what init/update print)
	// reports the deprecation + migration path for a composable.env project.
	it.skipIf(SHOULD_SKIP)(
		"T5: ce deprecation notice reports deprecation + migration path, non-destructively",
		async () => {
			writeFileSync(join(projectDir, "ce.json"), "{}\n");
			const { ceDeprecationNotice } = await import("../bin/commands/update.js");
			const notice = ceDeprecationNotice(projectDir);
			expect(notice).toBeTruthy();
			expect(notice).toMatch(/deprecated/);
			expect(notice).toMatch(/doppler/);
			expect(notice).toMatch(/composable-env-removal|migrate/);
			// non-destructive: ce.json is left untouched
			expect(existsSync(join(projectDir, "ce.json"))).toBe(true);
		},
		30_000,
	);

	// T6 — Passes at Phase 4. composable.env stays opt-in: doppler-as-default does
	// NOT remove or break an existing ce setup, and clean projects get no notice.
	// (composable-env is not a built-in indusk-mcp extension — it's added via
	//  `ce add-skill` — so the legacy guarantee is "ce.json survives", not
	//  "extensions enable composable-env".)
	it.skipIf(SHOULD_SKIP)(
		"T6: composable.env stays opt-in — ce.json survives and the notice is read-only",
		async () => {
			writeFileSync(join(projectDir, "ce.json"), '{"keep":true}\n');
			const { ceDeprecationNotice } = await import("../bin/commands/update.js");
			ceDeprecationNotice(projectDir);
			ceDeprecationNotice(projectDir);
			expect(readFileSync(join(projectDir, "ce.json"), "utf-8")).toBe('{"keep":true}\n');
			// a clean project (no ce.json) produces no notice
			rmSync(join(projectDir, "ce.json"));
			expect(ceDeprecationNotice(projectDir)).toBeNull();
		},
		30_000,
	);

	// Config-driven (dawn "config as source of truth"): prefix override, folder↔config
	// mapping, and explicit app list — all from .indusk/config.json's doppler section.
	it.skipIf(SHOULD_SKIP)(
		"config.doppler drives the prefix, folder↔config mapping, and app list",
		() => {
			for (const d of ["docs", "indusk-admin", "indusk-mcp"]) {
				mkdirSync(join(projectDir, "apps", d), { recursive: true });
			}
			mkdirSync(join(projectDir, ".indusk/extensions/doppler"), { recursive: true });
			writeFileSync(join(projectDir, ".indusk/extensions/doppler/.env"), "DOPPLER_TOKEN=t\n");
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({
					mode: "normal",
					otel: { role: "none" },
					doppler: {
						project: "indusk",
						profiles: { local: "local" },
						apps: [{ dir: "docs" }, { dir: "indusk-admin", config: "admin" }],
					},
				}),
			);
			const env = stubDoppler({ local_docs: { D: "1" }, local_admin: { A: "2" } });
			runCli(["doppler", "env-pull", "local"], env);
			// docs ← local_docs (prefix "local", not the default "loc")
			expect(readFileSync(join(projectDir, "apps/docs/.env.local"), "utf-8")).toMatch(/D=1/);
			// indusk-admin folder ← local_admin (config-name override)
			expect(readFileSync(join(projectDir, "apps/indusk-admin/.env.local"), "utf-8")).toMatch(
				/A=2/,
			);
			// indusk-mcp is not in the app list → not provisioned
			expect(existsSync(join(projectDir, "apps/indusk-mcp/.env.local"))).toBe(false);
		},
		30_000,
	);

	// Token-optional: with NO token file, env-pull falls back to the logged-in
	// Doppler CLI session (the stub stands in for it). Proves a `doppler login`
	// dev needs no token file. (Old behavior hard-errored on a missing token.)
	it.skipIf(SHOULD_SKIP)(
		"env-pull works without a token (relies on the doppler CLI session)",
		() => {
			mkdirSync(join(projectDir, "apps/docs"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({
					mode: "normal",
					otel: { role: "none" },
					doppler: { project: "indusk", profiles: { local: "local" }, apps: [{ dir: "docs" }] },
				}),
			);
			// no .indusk/extensions/doppler/.env written → no token
			const env = stubDoppler({ local_docs: { X: "1" } });
			const r = runCli(["doppler", "env-pull", "local"], env);
			const out = join(projectDir, "apps/docs/.env.local");
			expect(existsSync(out), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(true);
			expect(readFileSync(out, "utf-8")).toMatch(/X=1/);
		},
		30_000,
	);

	// `path` targets: env can land ANYWHERE, not just apps/<dir> — total composable.env
	// replacement control (root .env, packages/*, services/*, etc.).
	it.skipIf(SHOULD_SKIP)(
		"config.doppler `path` targets write outside apps/ (repo root + packages)",
		() => {
			mkdirSync(join(projectDir, "packages/db"), { recursive: true });
			mkdirSync(join(projectDir, ".indusk/extensions/doppler"), { recursive: true });
			writeFileSync(join(projectDir, ".indusk/extensions/doppler/.env"), "DOPPLER_TOKEN=t\n");
			writeFileSync(
				join(projectDir, ".indusk/config.json"),
				JSON.stringify({
					mode: "normal",
					otel: { role: "none" },
					doppler: {
						project: "indusk",
						profiles: { local: "local" },
						apps: [
							{ path: ".", config: "root" },
							{ path: "packages/db", config: "db" },
						],
					},
				}),
			);
			const env = stubDoppler({ local_root: { R: "1" }, local_db: { DB: "2" } });
			runCli(["doppler", "env-pull", "local"], env);
			// repo-root target
			expect(readFileSync(join(projectDir, ".env.local"), "utf-8")).toMatch(/R=1/);
			// non-apps package target
			expect(readFileSync(join(projectDir, "packages/db/.env.local"), "utf-8")).toMatch(/DB=2/);
		},
		30_000,
	);
});
