import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test plan: workbench-setup-command (T1–T7).
 *
 * `indusk setup <cloned-repo-path>` turns an already-cloned git repo into a
 * workbench in one command — derive name/parent, scaffold package.json,
 * symlink the trunk in-place, delegate to `init --workbench`.
 *
 * These are subprocess integration tests against the BUILT CLI, mirroring
 * init-no-git-warning.test.ts. They require `dist/bin/cli.js` (skipIf otherwise),
 * use a redirected INDUSK_HOME so the registry/daemon files don't leak, and
 * lean on init's graceful-degrade for pipx/docker/infra.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

/** git init + identity + one commit so `git worktree add` has a branch to base on. */
function initRepo(dir: string): void {
	mkdirSync(dir, { recursive: true });
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
	spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: dir });
	spawnSync("git", ["config", "user.name", "Test"], { cwd: dir });
	writeFileSync(join(dir, "README.md"), "# repo\n");
	spawnSync("git", ["add", "-A"], { cwd: dir });
	spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
}

function runCli(args: string[], cwd: string, home: string) {
	return spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		env: { ...process.env, INDUSK_HOME: home, INDUSK_SKIP_SELF_UPDATE: "1" },
		encoding: "utf-8",
	});
}

describe.skipIf(SHOULD_SKIP)(
	"indusk setup — one-shot workbench creation",
	{ timeout: 120000 },
	() => {
		let sibling: string; // parent dir holding the repo + the would-be workbench
		let home: string;

		beforeEach(() => {
			sibling = mkdtempSync(join(tmpdir(), "setup-sibling-"));
			home = mkdtempSync(join(tmpdir(), "setup-home-"));
		});

		afterEach(() => {
			rmSync(sibling, { recursive: true, force: true });
			rmSync(home, { recursive: true, force: true });
		});

		it("T1: setup on a fresh clone produces a config-valid workbench with a resolving trunk", () => {
			const repo = join(sibling, "myrepo");
			initRepo(repo);

			const res = runCli(["setup", repo], sibling, home);
			expect(res.status, `setup should exit 0: ${res.stderr}`).toBe(0);

			const workbench = join(sibling, "myrepo-workbench");
			const config = JSON.parse(readFileSync(join(workbench, ".indusk/config.json"), "utf-8"));
			expect(config.worktree?.shape).toBe("workbench");
			expect(config.worktree?.wrapped_repo).toBe("myrepo");
			expect(config.worktree?.sibling_parent).toBe(sibling);

			const list = runCli(["worktree", "list"], workbench, home);
			const out = `${list.stdout}${list.stderr}`;
			expect(out).toMatch(/config valid/i);
			expect(out).toMatch(/resolves/i);
		});

		it("T2: setup leaves the wrapped repo in place with its files intact", () => {
			const repo = join(sibling, "myrepo");
			initRepo(repo);
			writeFileSync(join(repo, "sentinel.txt"), "keep me");

			const res = runCli(["setup", repo], sibling, home);
			expect(res.status, res.stderr).toBe(0);

			expect(existsSync(join(repo, ".git"))).toBe(true);
			expect(readFileSync(join(repo, "sentinel.txt"), "utf-8")).toBe("keep me");
		});

		it("T3: after setup, a worktree can be created as a working sibling", () => {
			const repo = join(sibling, "myrepo");
			initRepo(repo);
			expect(runCli(["setup", repo], sibling, home).status).toBe(0);

			const workbench = join(sibling, "myrepo-workbench");
			const created = runCli(["worktree", "create", "feat-smoke"], workbench, home);
			expect(created.status, `worktree create failed: ${created.stderr}`).toBe(0);

			const wtDir = join(workbench, "feat-smoke");
			expect(existsSync(wtDir) && statSync(wtDir).isDirectory()).toBe(true);
		});

		it("T4: setup against a non-git path errors clearly and creates no workbench", () => {
			const notARepo = join(sibling, "plain-dir");
			mkdirSync(notARepo);

			const res = runCli(["setup", notARepo], sibling, home);
			expect(res.status).not.toBe(0);
			expect(res.stderr).toMatch(/not a git repository/i);
			expect(existsSync(join(sibling, "plain-dir-workbench"))).toBe(false);
		});

		it("T5: setup on an existing workbench errors, points at update, and preserves it", () => {
			const repo = join(sibling, "myrepo");
			initRepo(repo);
			expect(runCli(["setup", repo], sibling, home).status).toBe(0);

			const workbench = join(sibling, "myrepo-workbench");
			writeFileSync(join(workbench, "SENTINEL"), "do not clobber");

			const second = runCli(["setup", repo], sibling, home);
			expect(second.status).not.toBe(0);
			expect(second.stderr).toMatch(/already exists/i);
			expect(second.stderr).toMatch(/indusk update/);
			expect(readFileSync(join(workbench, "SENTINEL"), "utf-8")).toBe("do not clobber");
		});

		it("T6: a dirty working tree does not block setup", () => {
			const repo = join(sibling, "myrepo");
			initRepo(repo);
			writeFileSync(join(repo, "untracked.txt"), "new"); // untracked
			writeFileSync(join(repo, "README.md"), "# changed\n"); // modified tracked

			const res = runCli(["setup", repo], sibling, home);
			expect(res.status, `dirty repo should still set up: ${res.stderr}`).toBe(0);

			const config = JSON.parse(
				readFileSync(join(sibling, "myrepo-workbench/.indusk/config.json"), "utf-8"),
			);
			expect(config.worktree?.shape).toBe("workbench");
		});

		it("T7: init --workbench still produces a valid workbench (regression guard)", () => {
			const repo = join(sibling, "myrepo");
			initRepo(repo);

			const workbench = join(sibling, "myrepo-workbench");
			mkdirSync(workbench);
			writeFileSync(
				join(workbench, "package.json"),
				`${JSON.stringify({ name: "myrepo-workbench", version: "0.0.1", private: true }, null, 2)}\n`,
			);

			const res = runCli(
				["init", "--workbench", "--wrapped-repo", "myrepo", "--sibling-parent", sibling],
				workbench,
				home,
			);
			expect(res.status, `init --workbench failed: ${res.stderr}`).toBe(0);

			const config = JSON.parse(readFileSync(join(workbench, ".indusk/config.json"), "utf-8"));
			expect(config.worktree?.shape).toBe("workbench");
			expect(config.worktree?.wrapped_repo).toBe("myrepo");
		});
	},
);
