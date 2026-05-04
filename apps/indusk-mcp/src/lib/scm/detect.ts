/**
 * SCM detection and config-driven runtime resolution.
 *
 * `detectScm()` runs at init time — try jj, fall back to git. The result is
 * written once to `.indusk/config.json` as the `scm` field.
 *
 * `getScm()` runs everywhere else — reads the config field. **Default for
 * pre-existing projects without the field is `"jj"`** (preserves pre-1.28.x
 * behavior so projects scaffolded before this plan keep working until
 * `indusk update` migrates them).
 *
 * See `.indusk/planning/git-or-jj-substrate/` for design rationale.
 */

import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readConfig } from "../config.js";

const execFileAsync = promisify(execFile);

export type ScmKind = "jj" | "git";

export class NoScmDetectedError extends Error {
	constructor(cwd: string) {
		super(
			`Neither jj nor git detected at ${cwd} — InDusk requires one of them. ` +
				`Run 'git init' (or 'jj git init') in the project directory first.`,
		);
		this.name = "NoScmDetectedError";
	}
}

/**
 * Detect which SCM is in use at `projectRoot`. Tries jj first (preserves
 * historical default for any project that has both); falls back to git.
 * Throws `NoScmDetectedError` if neither responds.
 *
 * Called once at `indusk init` and `indusk update` time. Don't call this on
 * the hot path — use `getScm(projectRoot)` to read the cached config field.
 */
export async function detectScm(projectRoot: string): Promise<ScmKind> {
	if (await isJjRepo(projectRoot)) return "jj";
	if (await isGitRepo(projectRoot)) return "git";
	throw new NoScmDetectedError(projectRoot);
}

async function isJjRepo(cwd: string): Promise<boolean> {
	try {
		await execFileAsync("jj", ["log", "-r", "@", "--no-graph", "-T", "change_id"], {
			cwd,
		});
		return true;
	} catch (err) {
		const execErr = err as ExecFileException;
		// ENOENT — jj not on PATH
		// non-zero exit — not a jj repo
		if (execErr.code === "ENOENT" || typeof execErr.code === "number") return false;
		throw err;
	}
}

async function isGitRepo(cwd: string): Promise<boolean> {
	try {
		await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
		return true;
	} catch (err) {
		const execErr = err as ExecFileException;
		if (execErr.code === "ENOENT" || typeof execErr.code === "number") return false;
		throw err;
	}
}

/**
 * Read the `scm` field from `.indusk/config.json`. Returns `"jj"` when the
 * field is missing or the config doesn't exist yet — preserving the
 * pre-1.28.x default so projects scaffolded before this plan keep working
 * until `indusk update` migrates them.
 *
 * This is the runtime source of truth — call this everywhere that previously
 * called `getCurrentChangeId(cwd)` directly. `detectScm()` is for init/update
 * only.
 */
export function getScm(projectRoot: string): ScmKind {
	const config = readConfig(projectRoot);
	if (config?.scm === "git") return "git";
	return "jj";
}
