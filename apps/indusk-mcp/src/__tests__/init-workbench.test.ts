import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T16 — `indusk init --workbench --wrapped-repo X --sibling-parent Y`
 * scaffolds a flat single-repo workbench end-to-end:
 *   1. Validates that <sibling-parent>/<wrapped-repo> is a git repo
 *   2. Creates the trunk symlink at <workbench>/<wrapped-repo>
 *   3. Writes .indusk/config.json with worktree.{shape, wrapped_repo, sibling_parent}
 *   4. Triggers extensionsEnable(['worktree']) which materializes:
 *      - scripts/worktree/{setup,refresh,wt,wt-pm2,preflight}.sh + lib/
 *      - pnpm scripts in package.json (wt, wt:pm2, wt-setup, wt-refresh, preflight)
 *      - starter .indusk/worktree-configs/<wrapped-repo>.json with
 *        compose_project_name substituted
 *
 * After init: `node cli.js worktree list` works end-to-end.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let root: string;
let cloneDir: string;
let workbenchDir: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "init-workbench-"));
	cloneDir = join(root, "demo");
	workbenchDir = join(root, "demo-workbench");

	mkdirSync(cloneDir, { recursive: true });
	mkdirSync(workbenchDir, { recursive: true });

	// Initialize a tiny git repo at cloneDir so the canonical-clone check passes.
	const gitOpts = {
		cwd: cloneDir,
		encoding: "utf-8" as const,
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
	};
	spawnSync("git", ["init", "-q", "-b", "main"], gitOpts);
	writeFileSync(join(cloneDir, "README.md"), "# demo\n");
	writeFileSync(
		join(cloneDir, "package.json"),
		JSON.stringify({ name: "demo", version: "0.0.0" }, null, 2),
	);
	spawnSync("git", ["add", "-A"], gitOpts);
	spawnSync("git", ["commit", "-q", "-m", "initial"], gitOpts);

	// Workbench needs a package.json before init so the on_enable hook can
	// merge pnpm scripts into it.
	writeFileSync(
		join(workbenchDir, "package.json"),
		JSON.stringify({ name: "demo-workbench", version: "0.0.0", private: true }, null, 2),
	);
});

afterEach(() => {
	if (existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function runCli(
	cwd: string,
	args: string[],
): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: {
			...process.env,
			INDUSK_SKIP_UPDATE_CHECK: "1",
			INDUSK_BIN: `node ${CLI_BIN}`,
		},
		timeout: 60_000,
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe.skipIf(SHOULD_SKIP)("indusk init --workbench (T16)", () => {
	it("requires --wrapped-repo and --sibling-parent", () => {
		const r = runCli(workbenchDir, ["init", "--workbench", "--no-index"]);
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/requires --wrapped-repo .*AND --sibling-parent/);
	});

	it("rejects when the canonical clone doesn't exist", () => {
		const r = runCli(workbenchDir, [
			"init",
			"--workbench",
			"--wrapped-repo",
			"nonexistent",
			"--sibling-parent",
			root,
			"--no-index",
		]);
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/canonical clone not found/);
	});

	it("scaffolds the workbench end-to-end + worktree list works after", { timeout: 90_000 }, () => {
		const r = runCli(workbenchDir, [
			"init",
			"--workbench",
			"--wrapped-repo",
			"demo",
			"--sibling-parent",
			root,
			"--no-index",
		]);
		expect(r.code, r.stderr).toBe(0);

		// 1. Trunk symlink created
		const trunk = join(workbenchDir, "demo");
		expect(existsSync(trunk)).toBe(true);
		// dereferences to the canonical clone
		expect(existsSync(join(trunk, "README.md"))).toBe(true);

		// 2. .indusk/config.json marks workbench shape
		const cfg = JSON.parse(readFileSync(join(workbenchDir, ".indusk/config.json"), "utf-8"));
		expect(cfg.worktree?.shape).toBe("workbench");
		// The writer stays singular until Build Phase 2 lands the bash readers;
		// what Phase 1 guarantees is that every READER resolves it through the
		// reduction, which `worktree list` below demonstrates.
		expect(cfg.worktree?.wrapped_repo).toBe("demo");
		expect(cfg.worktree?.sibling_parent).toBe(root);

		// 3. on_enable scaffolding landed
		expect(existsSync(join(workbenchDir, "scripts/worktree/wt.sh"))).toBe(true);
		expect(existsSync(join(workbenchDir, "scripts/worktree/preflight.sh"))).toBe(true);

		// 4. pnpm scripts merged into package.json
		const pkg = JSON.parse(readFileSync(join(workbenchDir, "package.json"), "utf-8")) as {
			scripts?: Record<string, string>;
		};
		expect(pkg.scripts?.wt).toMatch(/scripts\/worktree\/wt\.sh/);
		expect(pkg.scripts?.["wt:pm2"]).toMatch(/scripts\/worktree\/wt-pm2\.sh/);
		expect(pkg.scripts?.preflight).toMatch(/scripts\/worktree\/preflight\.sh/);

		// 5. Starter worktree-configs/demo.json materialized w/ substituted name
		const wcfg = JSON.parse(
			readFileSync(join(workbenchDir, ".indusk/worktree-configs/demo.json"), "utf-8"),
		) as { compose_project_name?: string; trunk_branch?: string };
		expect(wcfg.trunk_branch).toBe("main");
		expect(wcfg.compose_project_name).toBe("demo");

		// 6. `worktree list` works end-to-end
		const listResult = runCli(workbenchDir, ["worktree", "list"]);
		expect(listResult.code, listResult.stderr).toBe(0);
		expect(listResult.stdout).toContain("Repos (1): demo");
		// The trunk line moved under a per-repo block; assert the block, not
		// just the name, so a regression to a flat single-repo render fails.
		expect(listResult.stdout).toMatch(/^demo$/m);
		expect(listResult.stdout).toContain("(config valid)");
	});
});

/**
 * A33 — `init --workbench` links the trunk the same way `restore` does.
 *
 * init hand-rolled the trunk symlink: it creates one when nothing is there and
 * prints "already exists" otherwise. That is a strict subset of `linkTrunk`,
 * missing both of the cases A30 spent a falsification round on — a DANGLING
 * link (points at a path that no longer exists, so `existsSync` is false but
 * the entry is real) and a REAL DIRECTORY sitting at the trunk path, which is
 * not ours to remove and must not be reported as linked.
 *
 * Both are ordinary on a workbench that has been moved or hand-assembled.
 */
describe.skipIf(SHOULD_SKIP)("A33 — init repairs and refuses like restore does", () => {
	it("repairs a dangling trunk symlink rather than leaving it", () => {
		// A link left over from a previous layout: the entry exists, its target
		// does not. `existsSync` reports false, so init's `existsSync` check took
		// the create branch and `symlinkSync` threw EEXIST — or, worse, the guard
		// passed and the stale link survived.
		symlinkSync("../somewhere-that-moved", join(workbenchDir, "demo"));
		expect(lstatSync(join(workbenchDir, "demo")).isSymbolicLink()).toBe(true);
		expect(existsSync(join(workbenchDir, "demo"))).toBe(false);

		const r = runCli(workbenchDir, [
			"init",
			"--workbench",
			"--wrapped-repo",
			"demo",
			"--sibling-parent",
			root,
			"--no-index",
		]);

		expect(r.code, `${r.stdout}${r.stderr}`).toBe(0);
		// Repaired: still a symlink, now pointing at the real clone.
		expect(lstatSync(join(workbenchDir, "demo")).isSymbolicLink()).toBe(true);
		expect(realpathSync(join(workbenchDir, "demo"))).toBe(realpathSync(cloneDir));
	});

	it("leaves a real directory alone and does not claim it linked", () => {
		// Not ours to remove — and saying "trunk symlink already exists" about a
		// directory that is not a symlink is the exact false claim A30 removed
		// from `restore`.
		mkdirSync(join(workbenchDir, "demo"), { recursive: true });
		writeFileSync(join(workbenchDir, "demo", "real.txt"), "not a symlink\n");

		const r = runCli(workbenchDir, [
			"init",
			"--workbench",
			"--wrapped-repo",
			"demo",
			"--sibling-parent",
			root,
			"--no-index",
		]);

		// The file survives, whatever else happens.
		expect(existsSync(join(workbenchDir, "demo", "real.txt"))).toBe(true);
		expect(lstatSync(join(workbenchDir, "demo")).isSymbolicLink()).toBe(false);
		// And it must not be described as a symlink that exists.
		expect(`${r.stdout}${r.stderr}`).not.toMatch(/trunk symlink already exists/);
		expect(`${r.stdout}${r.stderr}`).toMatch(/real directory|not a symlink|left as is/i);
	});
});
