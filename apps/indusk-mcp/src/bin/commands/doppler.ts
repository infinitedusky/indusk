import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * doppler extension — `env-pull` command.
 *
 * Reads the InDusk-level service token from `.indusk/extensions/doppler/.env`,
 * then for each app under `apps/*` runs
 *   doppler secrets download --project <P> --config <prefix>_<app> --format env
 * and writes the result to `apps/<app>/.env.<profile>` (gitignored).
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

/** Idempotently ensure the provisioned env files (and the token) are gitignored. */
function ensureGitignore(projectRoot: string): void {
	const path = join(projectRoot, ".gitignore");
	const current = existsSync(path) ? readFileSync(path, "utf-8") : "";
	if (current.includes(GITIGNORE_MARKER)) return;
	const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
	writeFileSync(path, `${current}${prefix}\n${GITIGNORE_BLOCK.join("\n")}\n`);
}

export function dopplerEnvPull(projectRoot: string, profile: string): void {
	const prefix = PROFILE_PREFIX[profile];
	if (!prefix) {
		console.error(`Unknown profile "${profile}". Use one of: local, staging, production.`);
		process.exit(1);
	}

	const tokenEnv = parseEnvFile(join(projectRoot, ".indusk/extensions/doppler/.env"));
	const token = tokenEnv.DOPPLER_TOKEN;
	const project = tokenEnv.DOPPLER_PROJECT;
	if (!token || !project) {
		console.error(
			"Missing DOPPLER_TOKEN or DOPPLER_PROJECT in .indusk/extensions/doppler/.env.\n" +
				"Copy the template: cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env",
		);
		process.exit(1);
	}

	const appsDir = join(projectRoot, "apps");
	if (!existsSync(appsDir)) {
		console.error(`No apps/ directory at ${appsDir} — nothing to provision.`);
		process.exit(1);
	}

	ensureGitignore(projectRoot);

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
				project,
				"--config",
				config,
				"--format",
				"env",
				"--no-file",
				"--token",
				token,
			],
			{ encoding: "utf-8" },
		);
		if (res.status !== 0) {
			console.error(
				`  ${app}: skipped — doppler download failed for ${config}: ${(res.stderr ?? "").trim()}`,
			);
			continue;
		}
		writeFileSync(join(appsDir, app, `.env.${profile}`), res.stdout);
		console.info(`  ${app} → apps/${app}/.env.${profile}`);
		written++;
	}
	console.info(
		`env-pull (${profile}): wrote ${written} file(s) from Doppler project "${project}".`,
	);
}
