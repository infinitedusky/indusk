import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readReposRoot, readWorkbenchRepos, repoDir } from "../../lib/worktree/repos.js";

/**
 * doppler extension — `env-pull` + worktree auto-provisioning.
 *
 * Config-driven (declarative, per the dawn "config as source of truth" direction):
 * the project's `.indusk/config.json` carries a `doppler` section —
 *
 *   "doppler": {
 *     "project": "indusk",                      // Doppler project
 *     "profiles": { "local": "local", "production": "prd" },  // profile → Doppler config-root
 *     "apps": [                                 // explicit app list (excludes libraries)
 *       { "dir": "docs" },                      // folder + Doppler leaf "<prefix>_docs"
 *       { "dir": "indusk-admin", "config": "admin" }  // folder indusk-admin → leaf "<prefix>_admin"
 *     ]
 *   }
 *
 * For each listed app, env-pull runs
 *   doppler secrets download --project <project> --config <prefix>_<config|dir> --format env
 * and writes `<appsRoot>/apps/<dir>/.env.<profile>` (gitignored).
 *
 * The token (DOPPLER_TOKEN) lives in the gitignored `.indusk/extensions/doppler/.env`.
 * When `.indusk/config.json` has no `doppler` section, env-pull falls back to globbing
 * `apps/*` with the default prefixes (local→loc, staging→stg, production→prd) and the
 * folder name as the Doppler config — backward-compatible with pre-config projects.
 */

const DEFAULT_PROFILE_PREFIX: Record<string, string> = {
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

interface DopplerAppConfig {
	dir?: string;
	path?: string;
	config?: string;
}

interface DopplerConfig {
	project?: string;
	profiles?: Record<string, string>;
	apps?: DopplerAppConfig[];
}

function parseEnvFile(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (!existsSync(path)) return out;
	for (const line of readFileSync(path, "utf-8").split("\n")) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

/** Read the `doppler` section from the project's `.indusk/config.json` (token-root). */
function readDopplerConfig(tokenRoot: string): DopplerConfig {
	const path = join(tokenRoot, ".indusk", "config.json");
	if (!existsSync(path)) return {};
	try {
		return ((JSON.parse(readFileSync(path, "utf-8")) as { doppler?: DopplerConfig }).doppler ??
			{}) as DopplerConfig;
	} catch {
		return {};
	}
}

/** Token (+ optional legacy project) from the gitignored extension `.env`. */
function readDopplerEnv(tokenRoot: string): { token?: string; project?: string } {
	const env = parseEnvFile(join(tokenRoot, ".indusk/extensions/doppler/.env"));
	return { token: env.DOPPLER_TOKEN, project: env.DOPPLER_PROJECT };
}

/** Resolve the app list: explicit config.apps, else glob apps/* (each folder as its own config). */
function resolveApps(cfg: DopplerConfig, appsRoot: string): DopplerAppConfig[] {
	if (cfg.apps && cfg.apps.length > 0) return cfg.apps;
	const appsDir = join(appsRoot, "apps");
	if (!existsSync(appsDir)) return [];
	return readdirSync(appsDir)
		.filter((a) => statSync(join(appsDir, a)).isDirectory())
		.map((dir) => ({ dir }));
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
 * Pull env from Doppler for every configured app under `appsRoot/apps`, using the
 * token + config at `tokenRoot`. Returns files written, or -1 on a hard error
 * (bad profile / missing token or project / no apps).
 */
function runEnvPull(
	tokenRoot: string,
	appsRoot: string,
	profile: string,
	opts: EnvPullOptions = {},
): number {
	const cfg = readDopplerConfig(tokenRoot);
	const prefix = cfg.profiles?.[profile] ?? DEFAULT_PROFILE_PREFIX[profile];
	if (!prefix) {
		console.error(
			`Unknown profile "${profile}". Use one of: local, staging, production (or declare it in .indusk/config.json doppler.profiles).`,
		);
		return -1;
	}

	const env = readDopplerEnv(tokenRoot);
	// Auth precedence: explicit service token (CI via DOPPLER_TOKEN env, or the
	// extension .env) → otherwise the logged-in Doppler CLI session (`doppler login`).
	// So a dev who's logged in needs no token file; CI sets DOPPLER_TOKEN from a secret.
	const token = process.env.DOPPLER_TOKEN ?? env.token;
	const project = cfg.project ?? env.project;
	if (!project) {
		if (!opts.quiet) {
			console.error(
				"Missing Doppler project. Set doppler.project in .indusk/config.json (or DOPPLER_PROJECT in the extension .env).",
			);
		}
		return -1;
	}

	const apps = resolveApps(cfg, appsRoot);
	if (apps.length === 0) {
		if (!opts.quiet)
			console.error(`No apps to provision (no doppler.apps config, no apps/* dirs).`);
		return -1;
	}

	if (opts.manageGitignore) ensureGitignore(appsRoot);

	let written = 0;
	for (const app of apps) {
		// Output dir: explicit `path` (relative to project root) or the `apps/<dir>` shorthand.
		const relDir = app.path ?? `apps/${app.dir}`;
		// Doppler leaf: explicit `config`, else the dir name, else the path basename.
		const name =
			app.config ?? app.dir ?? (app.path && app.path !== "." ? basename(app.path) : undefined);
		if (!name) {
			if (!opts.quiet) console.error(`  ${relDir}: skipped — set a "config" for this target`);
			continue;
		}
		const leaf = `${prefix}_${name}`;
		const outDir = join(appsRoot, relDir);
		if (!existsSync(outDir)) {
			if (!opts.quiet) console.error(`  ${relDir}: skipped — ${relDir} not found`);
			continue;
		}
		const dopplerArgs = [
			"secrets",
			"download",
			"--project",
			project,
			"--config",
			leaf,
			"--format",
			"env",
			"--no-file",
		];
		// Only pass --token when we have one; otherwise rely on `doppler login`.
		if (token) dopplerArgs.push("--token", token);
		const res = spawnSync("doppler", dopplerArgs, { encoding: "utf-8" });
		if (res.status !== 0) {
			if (!opts.quiet) {
				console.error(
					`  ${relDir}: skipped — doppler download failed for ${leaf}: ${(res.stderr ?? "").trim()}`,
				);
			}
			continue;
		}
		writeFileSync(join(outDir, `.env.${profile}`), res.stdout);
		if (!opts.quiet) console.info(`  ${relDir} → ${relDir}/.env.${profile} (${leaf})`);
		written++;
	}
	if (written === 0) {
		// A success line over a no-op is the failure this fixes. The observed
		// case: "auto-provisioned env for <slug>" printed while zero files were
		// written, so a developer saw success and got a worktree with no env.
		// A check must distinguish "nothing to do" from "did not run".
		console.error(
			`env-pull (${profile}): wrote NO files. ${apps.length} target(s) configured, none produced a file.`,
		);
		console.error(
			`       Check that each doppler.apps[].path exists relative to the app repo, and that the Doppler configs exist under project "${project}".`,
		);
		return -1;
	}
	if (!opts.quiet) {
		console.info(
			`env-pull (${profile}): wrote ${written} file(s) from Doppler project "${project}".`,
		);
	}
	return written;
}

/** CLI entry: `indusk doppler env-pull <profile>` — token + apps both at projectRoot. */
export function dopplerEnvPull(projectRoot: string, profile: string): void {
	// `path` is relative to the APPLICATION REPO, so it means one thing to both
	// callers. Previously this passed the workbench root while worktree
	// provisioning passed the worktree, so `path: "looper/backend"` made the
	// manual pull work and every worktree silently get nothing — one value that
	// could not be both.
	if (runEnvPull(projectRoot, appRepoRoot(projectRoot), profile, { manageGitignore: true }) < 0) {
		process.exit(1);
	}
}

/**
 * Where the application code is, for resolving `doppler.apps[].path`.
 *
 * A workbench with one declared repo resolves to that repo. Several declared
 * repos, or none, resolves to the project itself — the same behavior every
 * non-workbench project already had.
 */
function appRepoRoot(projectRoot: string): string {
	const repos = readWorkbenchRepos(projectRoot);
	if (repos.length !== 1) return projectRoot;
	const declared = readReposRoot(projectRoot);
	const base = !declared
		? join(projectRoot, "..")
		: declared.startsWith("/") || declared.startsWith("~")
			? declared
			: join(projectRoot, declared);
	return join(base, repoDir(repos[0]));
}

/**
 * Auto-provision a freshly-created worktree's env: token/config from the workbench
 * root, apps written into the worktree. Attempts when the doppler extension is enabled
 * for the workbench; auth resolves to a service token (env/.env) or the logged-in
 * Doppler CLI session. Returns true if it ran without a hard error, false to skip
 * silently (extension not enabled). Per-app download failures are non-fatal.
 */
export function provisionWorktreeEnv(
	workbenchRoot: string,
	worktreeDir: string,
	profile = "local",
): boolean {
	if (!existsSync(join(workbenchRoot, ".indusk", "extensions", "doppler"))) return false;
	return runEnvPull(workbenchRoot, worktreeDir, profile, { manageGitignore: false }) >= 0;
}
