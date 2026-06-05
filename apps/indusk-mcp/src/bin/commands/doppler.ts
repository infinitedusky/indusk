import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * doppler extension — `env-pull` + worktree auto-provisioning.
 *
 * `env-pull` reads the InDusk-level service token from
 * `<tokenRoot>/.indusk/extensions/doppler/.env`, then for each app under
 * `<appsRoot>/apps/*` runs
 *   doppler secrets download --project <P> --config <prefix>_<app> --format env
 * and writes `<appsRoot>/apps/<app>/.env.<profile>` (gitignored).
 *
 * For a standalone project tokenRoot === appsRoot === projectRoot. For a worktree
 * the token lives at the workbench root while apps live in the worktree, so the
 * two roots differ (see `provisionWorktreeEnv`).
 *
 * Profiles map to Doppler config prefixes: local→loc, staging→stg, production→prd.
 * The `test` profile is intentionally NOT pulled — `.env.test` is committed to git
 * with safe defaults.
 */

const PROFILE_PREFIX: Record<string, string> = {
	local: "loc",
	staging: "stg",
	production: "prd",
};

const GITIGNORE_MARKER = "# doppler env-pull (machine-local, provisioned from Doppler)";
const GITIGNORE_BLOCK = [
	GITIGNORE_MARKER,
	".indusk/extensions/doppler/.env",
	"apps/*/.env.local",
	"apps/*/.env.staging",
	"apps/*/.env.production",
];

function parseEnvFile(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (!existsSync(path)) return out;
	for (const line of readFileSync(path, "utf-8").split("\n")) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

/** Read the InDusk-level Doppler token + project, or null if not configured. */
function readDopplerCreds(tokenRoot: string): { token: string; project: string } | null {
	const env = parseEnvFile(join(tokenRoot, ".indusk/extensions/doppler/.env"));
	if (!env.DOPPLER_TOKEN || !env.DOPPLER_PROJECT) return null;
	return { token: env.DOPPLER_TOKEN, project: env.DOPPLER_PROJECT };
}

/** Idempotently ensure the provisioned env files (and the token) are gitignored. */
function ensureGitignore(projectRoot: string): void {
	const path = join(projectRoot, ".gitignore");
	const current = existsSync(path) ? readFileSync(path, "utf-8") : "";
	if (current.includes(GITIGNORE_MARKER)) return;
	const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
	writeFileSync(path, `${current}${prefix}\n${GITIGNORE_BLOCK.join("\n")}\n`);
}

interface EnvPullOptions {
	manageGitignore?: boolean;
	quiet?: boolean;
}

/**
 * Pull env from Doppler for every app under `appsRoot/apps`, using the token at
 * `tokenRoot`. Returns the number of files written, or -1 on a hard error
 * (bad profile / missing token / no apps dir).
 */
function runEnvPull(
	tokenRoot: string,
	appsRoot: string,
	profile: string,
	opts: EnvPullOptions = {},
): number {
	const prefix = PROFILE_PREFIX[profile];
	if (!prefix) {
		console.error(`Unknown profile "${profile}". Use one of: local, staging, production.`);
		return -1;
	}

	const creds = readDopplerCreds(tokenRoot);
	if (!creds) {
		if (!opts.quiet) {
			console.error(
				"Missing DOPPLER_TOKEN or DOPPLER_PROJECT in .indusk/extensions/doppler/.env.\n" +
					"Copy the template: cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env",
			);
		}
		return -1;
	}

	const appsDir = join(appsRoot, "apps");
	if (!existsSync(appsDir)) {
		if (!opts.quiet) console.error(`No apps/ directory at ${appsDir} — nothing to provision.`);
		return -1;
	}

	if (opts.manageGitignore) ensureGitignore(appsRoot);

	const apps = readdirSync(appsDir).filter((a) => statSync(join(appsDir, a)).isDirectory());
	let written = 0;
	for (const app of apps) {
		const config = `${prefix}_${app}`;
		const res = spawnSync(
			"doppler",
			[
				"secrets",
				"download",
				"--project",
				creds.project,
				"--config",
				config,
				"--format",
				"env",
				"--no-file",
				"--token",
				creds.token,
			],
			{ encoding: "utf-8" },
		);
		if (res.status !== 0) {
			if (!opts.quiet) {
				console.error(
					`  ${app}: skipped — doppler download failed for ${config}: ${(res.stderr ?? "").trim()}`,
				);
			}
			continue;
		}
		writeFileSync(join(appsDir, app, `.env.${profile}`), res.stdout);
		if (!opts.quiet) console.info(`  ${app} → apps/${app}/.env.${profile}`);
		written++;
	}
	if (!opts.quiet) {
		console.info(
			`env-pull (${profile}): wrote ${written} file(s) from Doppler project "${creds.project}".`,
		);
	}
	return written;
}

/** CLI entry: `indusk doppler env-pull <profile>` — token + apps both at projectRoot. */
export function dopplerEnvPull(projectRoot: string, profile: string): void {
	if (runEnvPull(projectRoot, projectRoot, profile, { manageGitignore: true }) < 0) {
		process.exit(1);
	}
}

/**
 * Auto-provision a freshly-created worktree's env: token from the workbench root,
 * apps from the worktree. Returns true if doppler is configured (token present)
 * and provisioning ran; false to skip silently (extension not set up).
 */
export function provisionWorktreeEnv(
	workbenchRoot: string,
	worktreeDir: string,
	profile = "local",
): boolean {
	if (!readDopplerCreds(workbenchRoot)) return false;
	runEnvPull(workbenchRoot, worktreeDir, profile, { manageGitignore: false });
	return true;
}
