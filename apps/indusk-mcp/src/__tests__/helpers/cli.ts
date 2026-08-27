import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The two things every CLI-boundary test needs: run the built CLI, and run git
 * deterministically.
 *
 * Both were copy-pasted per file — `runCli` into ten files byte-identically,
 * `git` into five in three shapes. Phase 1's Shape review saw the first at
 * eight copies and deferred it to `/cleanup`, correctly: the rule of three is
 * cleanup's question, and the right shape was not settled while the CLI surface
 * was still growing. It is settled now.
 */

/**
 * The monorepo root.
 *
 * FIVE levels up, not four: this file lives in `__tests__/helpers/`, one deeper
 * than the suites that used to compute it themselves. Getting it wrong does not
 * fail — it makes `CLI_BIN` point at nothing, `SHOULD_SKIP` go true, and every
 * suite report green by not running. It cost ten silently-skipped files on the
 * first attempt at this extraction, which is why the assertion below exists.
 */
export const REPO_ROOT = resolve(__dirname, "../../../../..");

/** The built CLI. Tests run `dist/`, not source — they assert the real path. */
export const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

if (!existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))) {
	// A wrong root is indistinguishable from "the CLI is not built" once it
	// reaches SHOULD_SKIP, so it is caught here where the two are still
	// distinguishable. Loud beats a suite that quietly does not run.
	throw new Error(`test helper resolved REPO_ROOT to ${REPO_ROOT}, which is not the monorepo root`);
}

/**
 * Skip when there is nothing to run against.
 *
 * A CLI test with no built CLI would fail for a reason that has nothing to do
 * with the code under test, so these suites skip rather than go red. This is
 * only safe because REPO_ROOT is verified above — otherwise it silently
 * converts a broken path into a passing run.
 */
export const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

export interface RunResult {
	code: number;
	stdout: string;
	stderr: string;
}

/** Run the built CLI in `cwd`. */
export function runCli(cwd: string, args: string[]): RunResult {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Run git with a committer identity always set.
 *
 * The identity is not optional here even for read-only commands, and that is
 * the point: three of the five copies this replaces set it and two did not.
 * The two that did not only read today, so nothing failed — but the omission
 * was invisible, and the next file to copy one of them and then commit would
 * have broken on any machine without a global `user.email`.
 *
 * Returns all three channels so every previous caller can read what it needs:
 * some wanted stdout, some the exit code, one nothing at all.
 */
export function git(cwd: string, args: string[]): RunResult {
	const r = spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
	});
	return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * `git`, stdout only.
 *
 * Three of the suites this serves read output and never the exit code. A
 * per-file `(cwd, args) => git(cwd, args).stdout` in each would put the spawn
 * back behind three different names, so the convenience lives here once.
 */
export function gitOut(cwd: string, args: string[]): string {
	return git(cwd, args).stdout;
}
