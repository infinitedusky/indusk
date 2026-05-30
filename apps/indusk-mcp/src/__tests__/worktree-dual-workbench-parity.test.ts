import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * T13 — Same extension + config schema + `pnpm wt` surface behave
 * identically against two distinct workbenches.
 *
 * Original Phase 7 framing was dawn-fde-toolkit + numero-workbench;
 * with multi-repo workbenches deferred (shape revision 2026-05-28),
 * the dogfood matrix collapses to TWO single-repo workbenches built
 * via the same fixture. Each fixture wraps a different canonical
 * clone with its own slug list — the assertion is that operations
 * produce identical-shape outputs across both.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SETUP_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh",
);
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixtureA: WorktreeFixture | undefined;
let fixtureB: WorktreeFixture | undefined;

afterEach(() => {
	fixtureA?.cleanup();
	fixtureB?.cleanup();
});

function runBash(
	script: string,
	cwd: string,
	args: string[],
): { code: number; stdout: string; stderr: string } {
	const r = spawnSync(script, args, { cwd, encoding: "utf-8" });
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe.skipIf(SHOULD_SKIP)(
	"T13: dual-workbench parity (same surface, two distinct workbenches)",
	() => {
		it("create-then-list produces identical shape across both workbenches", () => {
			fixtureA = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			fixtureB = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });

			// Each fixture's wrapped repo is named 'clone' (fixture default) —
			// distinct workbench roots + distinct git clones underneath.
			expect(fixtureA.workbenchDir).not.toBe(fixtureB.workbenchDir);
			expect(fixtureA.cloneDir).not.toBe(fixtureB.cloneDir);

			const sA = runBash(SETUP_SCRIPT, fixtureA.workbenchDir, ["alpha"]);
			const sB = runBash(SETUP_SCRIPT, fixtureB.workbenchDir, ["alpha"]);
			expect(sA.code, sA.stderr).toBe(0);
			expect(sB.code, sB.stderr).toBe(0);

			const lA = runCli(fixtureA.workbenchDir, ["worktree", "list"]);
			const lB = runCli(fixtureB.workbenchDir, ["worktree", "list"]);
			expect(lA.code, lA.stderr).toBe(0);
			expect(lB.code, lB.stderr).toBe(0);

			// Both should have the same labels + status badges, just different paths
			const stripPaths = (s: string): string =>
				s.replace(/\/[^ \n]+\/wt-fixture-[A-Za-z0-9]+/g, "/<tmpdir>/wt-fixture-XXX");
			expect(stripPaths(lA.stdout)).toBe(stripPaths(lB.stdout));
		});

		it("duplicate-create exits non-zero identically", () => {
			fixtureA = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			fixtureB = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });

			runBash(SETUP_SCRIPT, fixtureA.workbenchDir, ["dup"]);
			runBash(SETUP_SCRIPT, fixtureB.workbenchDir, ["dup"]);

			const dupA = runBash(SETUP_SCRIPT, fixtureA.workbenchDir, ["dup"]);
			const dupB = runBash(SETUP_SCRIPT, fixtureB.workbenchDir, ["dup"]);

			expect(dupA.code).toBe(dupB.code);
			expect(dupA.code).not.toBe(0);
			expect(dupA.stderr).toContain("already exists");
			expect(dupB.stderr).toContain("already exists");
		});

		it("config-invalid surfaces identically on both workbenches", () => {
			fixtureA = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			fixtureB = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });

			writeFileSync(fixtureA.worktreeConfigPath, JSON.stringify({ wrong: 1 }));
			writeFileSync(fixtureB.worktreeConfigPath, JSON.stringify({ wrong: 1 }));

			const lA = runCli(fixtureA.workbenchDir, ["worktree", "list"]);
			const lB = runCli(fixtureB.workbenchDir, ["worktree", "list"]);

			expect(lA.code).toBe(lB.code);
			expect(lA.stdout).toMatch(/\(config invalid/);
			expect(lB.stdout).toMatch(/\(config invalid/);
		});
	},
);
