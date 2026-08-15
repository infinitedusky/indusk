import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * E2E harness for git-mode InDusk projects.
 *
 * Used by the `git-only-substrate` plan's Phase 1 trajectory tests
 * (T1, T3, T4) and Phase 5 (T10). Hands callers a sandboxed git project
 * + a sandboxed INDUSK_HOME + a CLI runner that points at the built
 * dist/bin/cli.js with all the env knobs set (INDUSK_SKIP_SELF_UPDATE=1
 * so offline test runs don't reach npm, INDUSK_BIN pointed at the same
 * CLI so any in-process `indusk ...` hook substitutions stay self-
 * consistent).
 *
 * Shape mirrors the existing tests at apps/indusk-mcp/src/__tests__/
 * git-mode-graph-sync.test.ts and git-mode-graph-cli.test.ts — those
 * tests are getting deleted as part of Phase 1 (they assert the
 * graceful-degrade behavior that goes away when the early-returns
 * come down), but the spawnSync + INDUSK_HOME shape is reusable.
 */

export const REPO_ROOT = resolve(__dirname, "../../../../..");
export const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
export const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

export interface GitTmpProject {
	projectDir: string;
	testHome: string;
}

export interface CliResult {
	code: number;
	stdout: string;
	stderr: string;
}

/**
 * Create a fresh tmp project + tmp INDUSK_HOME, git-init the project,
 * configure a test git user. Returns paths the caller passes to runCli
 * and gitCommit. Caller MUST call cleanupGitTmpProject in afterEach.
 */
export function setupGitTmpProject(prefix = "git-tmp"): GitTmpProject {
	const testHome = mkdtempSync(join(tmpdir(), `${prefix}-home-`));
	const projectDir = mkdtempSync(join(tmpdir(), `${prefix}-proj-`));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: `${prefix}-smoke`, version: "0.0.0" }, null, 2),
	);
	const gitInit = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
	if (gitInit.status !== 0) {
		throw new Error(`git init failed in ${projectDir}: ${gitInit.stderr?.toString() ?? ""}`);
	}
	spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: projectDir });
	spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });
	return { projectDir, testHome };
}

export function cleanupGitTmpProject(p: GitTmpProject): void {
	if (existsSync(p.testHome)) rmSync(p.testHome, { recursive: true, force: true });
	if (existsSync(p.projectDir)) rmSync(p.projectDir, { recursive: true, force: true });
}

/**
 * Run the built indusk CLI against the project. Pre-configured env:
 *  - INDUSK_HOME pointed at testHome
 *  - INDUSK_BIN pointed at the same CLI for in-process `indusk ...` rewrites
 *  - INDUSK_SKIP_SELF_UPDATE=1 so offline test runs don't hit npm
 */
export function runCli(
	p: GitTmpProject,
	args: string[],
	extraEnv: NodeJS.ProcessEnv = {},
): CliResult {
	const result: SpawnSyncReturns<string> = spawnSync("node", [CLI_BIN, ...args], {
		cwd: p.projectDir,
		env: {
			...process.env,
			INDUSK_HOME: p.testHome,
			INDUSK_BIN: `node ${CLI_BIN}`,
			INDUSK_SKIP_SELF_UPDATE: "1",
			...extraEnv,
		},
		encoding: "utf-8",
	});
	return {
		code: result.status ?? 0,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

/**
 * Write a file in the project dir and commit it with the given message.
 * Returns the new HEAD's short SHA.
 */
export function gitCommit(
	p: GitTmpProject,
	relPath: string,
	content: string,
	message: string,
): string {
	const fullPath = join(p.projectDir, relPath);
	const parent = dirname(fullPath);
	if (!existsSync(parent)) {
		mkdirSync(parent, { recursive: true });
	}
	writeFileSync(fullPath, content);
	const add = spawnSync("git", ["add", relPath], { cwd: p.projectDir });
	if (add.status !== 0) {
		throw new Error(`git add ${relPath} failed: ${add.stderr?.toString() ?? ""}`);
	}
	const commit = spawnSync("git", ["commit", "-q", "-m", message], { cwd: p.projectDir });
	if (commit.status !== 0) {
		throw new Error(`git commit failed: ${commit.stderr?.toString() ?? ""}`);
	}
	const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
		cwd: p.projectDir,
		encoding: "utf-8",
	});
	return (sha.stdout ?? "").trim();
}
