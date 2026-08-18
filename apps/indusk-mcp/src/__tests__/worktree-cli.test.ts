import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * T11 / T14 / T18 (scaffold) — the TS-implemented `indusk worktree`
 * CLI surface.
 *
 *   T11: `indusk worktree list` prints workbench + wrapped repo + trunk
 *        status + config status badge + worktree list. Three config
 *        states covered: valid / missing / invalid.
 *   T14: `indusk worktree create <slug>` twice with the same slug exits
 *        non-zero with "already exists" stderr.
 *   T18 scaffold: starter `compose_project_name` defaults to the wrapped
 *        repo's name (verifying the on_enable hook's substitution
 *        behavior; full cross-cwd docker smoke is Phase 7 manual).
 *
 * Tests spawn `node dist/bin/cli.js worktree <cmd>` against a tmpdir
 * fixture. The fixture is workbench-shaped; the CLI flows through the
 * full TS+bash stack (worktree list reads via the Phase 2 validator;
 * create + preflight wrap their bash scripts via runWorktreeScript).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: WorktreeFixture;

afterEach(() => {
	fixture?.cleanup();
});

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe.skipIf(SHOULD_SKIP)("indusk worktree <subcommand>", () => {
	describe("T11: list shows wrapped repo + trunk + config + worktrees", () => {
		it("config-valid state: prints '(config valid)' + no worktrees yet", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: { trunk_branch: "main" },
			});
			const r = runCli(fixture.workbenchDir, ["worktree", "list"]);
			expect(r.code, r.stderr).toBe(0);
			// versioned-workbench: the listing is one block per declared repo.
			// A legacy `wrapped_repo` workbench reduces to exactly one, which is
			// what this line now pins — the reduction, seen from the CLI.
			expect(r.stdout).toContain("Repos (1): clone");
			expect(r.stdout).toMatch(/^clone$/m);
			expect(r.stdout).toContain("clone → ../clone");
			expect(r.stdout).toContain("(config valid)");
			expect(r.stdout).toMatch(/Worktrees:\s+\(none\)/);
		});

		it("config-missing state: prints '(config missing)' when no worktree-config exists", () => {
			fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			// Remove the per-repo config the fixture writes.
			const cfg = join(fixture.workbenchDir, ".indusk/worktree-configs/clone.json");
			if (existsSync(cfg)) require("node:fs").unlinkSync(cfg);

			const r = runCli(fixture.workbenchDir, ["worktree", "list"]);
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toContain("(config missing)");
		});

		it("config-invalid state: prints '(config invalid: ...)' with the offending field", () => {
			fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			// Overwrite the per-repo config with a malformed shape.
			writeFileSync(fixture.worktreeConfigPath, JSON.stringify({ trunk_branch: 42 }, null, 2));

			const r = runCli(fixture.workbenchDir, ["worktree", "list"]);
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toMatch(/\(config invalid:\s*trunk_branch/);
		});

		it("with worktrees: lists their slugs (excluding the trunk)", () => {
			fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			const create1 = runCli(fixture.workbenchDir, ["worktree", "create", "alpha"]);
			expect(create1.code, create1.stderr).toBe(0);
			const create2 = runCli(fixture.workbenchDir, ["worktree", "create", "beta"]);
			expect(create2.code, create2.stderr).toBe(0);

			const r = runCli(fixture.workbenchDir, ["worktree", "list"]);
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toMatch(/Worktrees \(2\):/);
			expect(r.stdout).toContain("alpha");
			expect(r.stdout).toContain("beta");
			// Trunk name 'clone' should not appear in the worktree list section.
			const worktreeSection = r.stdout.split("Worktrees")[1] ?? "";
			expect(worktreeSection).not.toMatch(/^\s+clone\b/m);
		});

		it("non-workbench project: errors out cleanly", () => {
			fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			// Mutate the workbench config to drop worktree.shape.
			const cfgPath = join(fixture.workbenchDir, ".indusk/config.json");
			const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
			delete cfg.worktree.shape;
			writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

			const r = runCli(fixture.workbenchDir, ["worktree", "list"]);
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/not a workbench/);
		});
	});

	describe("T14: create twice with same slug exits non-zero", () => {
		it("second create exits non-zero with 'already exists' + state isn't corrupted", () => {
			fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			const r1 = runCli(fixture.workbenchDir, ["worktree", "create", "dup"]);
			expect(r1.code, r1.stderr).toBe(0);

			const r2 = runCli(fixture.workbenchDir, ["worktree", "create", "dup"]);
			expect(r2.code).not.toBe(0);
			expect(r2.stderr).toMatch(/already exists/);

			// State assertion: the dup worktree dir still exists + git status is clean
			const dupGitStatus = spawnSync("git", ["status", "--short"], {
				cwd: join(fixture.workbenchDir, "dup"),
				encoding: "utf-8",
			});
			expect(dupGitStatus.status).toBe(0);
			expect(dupGitStatus.stdout).toBe("");
		});
	});

	describe("T18 scaffold: starter config substitutes compose_project_name with wrapped_repo", () => {
		it("after on_enable, the starter config's compose_project_name matches the wrapped repo's name", () => {
			fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
			// The fixture pre-writes a worktree-config; the on_enable starter only
			// materializes if absent. Delete it so on_enable's template substitution
			// path runs.
			require("node:fs").unlinkSync(fixture.worktreeConfigPath);

			const r = runCli(fixture.workbenchDir, ["worktree", "_on-enable"]);
			expect(r.code, r.stderr).toBe(0);

			expect(existsSync(fixture.worktreeConfigPath)).toBe(true);
			const cfg = JSON.parse(readFileSync(fixture.worktreeConfigPath, "utf-8")) as {
				compose_project_name?: string;
			};
			expect(cfg.compose_project_name).toBe("clone");
		});
	});
});
