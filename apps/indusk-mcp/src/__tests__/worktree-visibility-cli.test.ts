import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test Trajectory for the worktree-visibility plan — Phase 1 CLI rows.
 *
 *   T1 — `indusk agent list` shows each session's worktree + branch.
 *   T2 — recompute-not-snapshot: after the caller's branch changes, the next
 *        `agent list` shows the NEW branch (heartbeat recomputes from cwd).
 *   T3 — same-tree collision flag: two sessions in one tree are flagged; two in
 *        separate worktrees are not.
 *
 * Layout mirrors workbench mode: `.indusk/` lives at the workbench root; the git
 * repos (main tree + linked worktrees) are children, so all sessions share one
 * `current.md`. Needs the built CLI (dist) + real git; skips when dist absent.
 * See .indusk/planning/worktree-visibility/impl.md.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

function git(cwd: string, args: string[]): void {
	spawnSync("git", args, { cwd, encoding: "utf-8" });
}

let scratch: string[] = [];

/** Workbench root with `.indusk/`, plus a `repo/` git repo on `main` with one commit. */
function makeWorkbench(): { wb: string; repo: string } {
	const wb = mkdtempSync(join(tmpdir(), "wt-vis-"));
	scratch.push(wb);
	mkdirSync(join(wb, ".indusk"), { recursive: true });
	writeFileSync(
		join(wb, ".indusk/config.json"),
		JSON.stringify({ mode: "normal", agents: { stale_ttl_minutes: 60 } }),
	);
	const repo = join(wb, "repo");
	mkdirSync(repo, { recursive: true });
	git(repo, ["init", "-b", "main"]);
	git(repo, ["config", "user.email", "t@t.dev"]);
	git(repo, ["config", "user.name", "t"]);
	writeFileSync(join(repo, "README.md"), "# t\n");
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-m", "init"]);
	return { wb, repo };
}

function runCli(
	cwd: string,
	sessionId: string,
	args: string[],
): { stdout: string; stderr: string; status: number | null } {
	const res = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		env: { ...process.env, CLAUDE_CODE_SESSION_ID: sessionId },
		encoding: "utf-8",
	});
	return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", status: res.status };
}

const S1 = "aaaaaaaa-1111-2222-3333-444444444444";
const S2 = "bbbbbbbb-5555-6666-7777-888888888888";

describe.skipIf(SHOULD_SKIP)("worktree-visibility CLI (Phase 1)", () => {
	beforeEach(() => {
		scratch = [];
	});
	afterEach(() => {
		for (const d of scratch) rmSync(d, { recursive: true, force: true });
	});

	it("T1: agent list shows the session's worktree and branch", () => {
		const { repo } = makeWorkbench();
		runCli(repo, S1, ["agent", "register", "--task", "phase 1 work"]);
		const { stdout } = runCli(repo, S1, ["agent", "list"]);
		expect(stdout).toContain("WORKTREE");
		expect(stdout).toContain("BRANCH");
		expect(stdout).toContain("main"); // branch cell
		expect(stdout).toContain(basename(repo)); // worktree basename cell
	});

	it("T2: agent list recomputes the branch after the caller switches branches", () => {
		const { repo } = makeWorkbench();
		runCli(repo, S1, ["agent", "register", "--task", "initial work"]);
		// Switch branch AFTER register — a snapshot impl would still show `main`.
		git(repo, ["checkout", "-b", "feature-x"]);
		const { stdout } = runCli(repo, S1, ["agent", "list"]);
		expect(stdout).toContain("feature-x");
		expect(stdout).not.toMatch(/\bmain\b/); // recomputed, no stale `main`
	});

	it("T3: two sessions in the same tree are flagged; separate worktrees are not", () => {
		const { wb, repo } = makeWorkbench();
		runCli(repo, S1, ["agent", "register", "--task", "s1"]);
		runCli(repo, S2, ["agent", "register", "--task", "s2"]);
		// Both resolve to the same worktree toplevel → collision.
		const shared = runCli(repo, S1, ["agent", "list"]);
		expect(shared.stderr).toMatch(/collision/i);

		// Move S2 into a separate linked worktree under the same workbench root.
		const wtB = join(wb, "wtb");
		git(repo, ["worktree", "add", "-b", "feature-b", wtB]);
		runCli(wtB, S2, ["agent", "register", "--task", "s2 in wtb"]);
		const split = runCli(repo, S1, ["agent", "list"]);
		expect(split.stderr).not.toMatch(/collision/i);
	});

	it("T10: `agent list` from a non-git cwd (workbench root) preserves worktree/branch and keeps the collision", () => {
		const { wb, repo } = makeWorkbench();
		// Both sessions register INSIDE the git repo (the trunk) → recorded worktree = repo.
		runCli(repo, S1, ["agent", "register", "--task", "s1 in trunk"]);
		runCli(repo, S2, ["agent", "register", "--task", "s2 in trunk"]);
		// S1 now runs `agent list` FROM the workbench root, which is NOT a git repo
		// (this is where .indusk/ lives — a completely normal place to run it).
		const { stdout, stderr } = runCli(wb, S1, ["agent", "list"]);
		// S1's worktree/branch must be PRESERVED (basename of repo, branch main), not wiped to "—".
		expect(stdout).toContain(basename(repo));
		expect(stdout).toContain("main");
		// And the real same-trunk collision must still fire (S1 must not have dropped out of it).
		expect(stderr).toMatch(/collision/i);
	});
});
