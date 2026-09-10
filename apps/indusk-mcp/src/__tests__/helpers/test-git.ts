import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The one throwing git runner for test fixtures.
 *
 * The suite carried fourteen private git helpers; four of them shared this
 * contract — run git with a fixed test identity, throw on a non-zero exit,
 * initialize a repo with one README commit — and each had drifted a little
 * (different emails, `-b main` or not, `execSync` shell strings or argv). A
 * fixture that half-builds proves nothing, so the failure mode is a throw,
 * never a return code the caller forgets to read. Helpers that deliberately
 * return `{ code, stdout }` are a different contract and stay where they are.
 *
 * Extracted by workbench-trust-fixes' cleanup phase from
 * `helpers/versioned-workbench.ts`.
 */

export const TEST_GIT_ENV = {
	GIT_AUTHOR_NAME: "test",
	GIT_AUTHOR_EMAIL: "test@test.local",
	GIT_COMMITTER_NAME: "test",
	GIT_COMMITTER_EMAIL: "test@test.local",
} as const;

/** Run git and throw on a non-zero exit. `env` is merged over the test identity (e.g. commit dates). */
export function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
	const r = spawnSync("git", args, {
		cwd,
		env: { ...process.env, ...TEST_GIT_ENV, ...env },
		encoding: "utf-8",
	});
	if (r.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed (cwd=${cwd}, code=${r.status}): ${r.stderr}`);
	}
	return r.stdout.trim();
}

export function headOf(dir: string): string {
	return git(dir, ["rev-parse", "HEAD"]);
}

/** `git init -b main` plus one README commit, creating `dir` if needed. */
export function initRepoWithCommit(dir: string, label = "init"): void {
	mkdirSync(dir, { recursive: true });
	git(dir, ["init", "-q", "-b", "main"]);
	writeFileSync(join(dir, "README.md"), `# ${label}\n`);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-q", "-m", `init ${label}`]);
}
