import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * T5–T8 — wt.sh + wt-pm2.sh (execution surface).
 *
 *   T5: `pnpm wt <slug>` resolves via single-pass workbench-root lookup.
 *       Exact, suffix-match, ambiguous → error, zero → error.
 *   T6: `pnpm wt <wrapped-repo-name>` resolves to the trunk symlink.
 *   T7: `pnpm wt:pm2 <slug>:<app> <cmd> <slug>:<app> <cmd>` parses pairs
 *       and would invoke pm2 with the right args. (Dry-run mode; full
 *       pass at Phase 7 manual smoke.)
 *   T8: `pnpm wt <slug>` resolved-dir is the worktree dir, NOT the trunk.
 *       (Full ce composition is Phase 7 manual smoke.)
 *
 * Tests invoke the bash scripts directly (not via `pnpm wt …`) so we
 * don't depend on `pnpm` discovering the fixture's package.json scripts.
 * The on_enable hook is exercised separately in worktree-extension-enable.test.ts
 * at Phase 6 when the workbench-side package.json scripts are needed.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SETUP_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh",
);
const WT_SCRIPT = join(REPO_ROOT, "apps/indusk-mcp/extensions/worktree/scripts/wt.sh");
const WT_PM2_SCRIPT = join(REPO_ROOT, "apps/indusk-mcp/extensions/worktree/scripts/wt-pm2.sh");

let fixture: WorktreeFixture;

afterEach(() => {
	fixture?.cleanup();
});

function run(
	script: string,
	cwd: string,
	args: string[],
	env?: Record<string, string>,
): { code: number; stdout: string; stderr: string } {
	const r = spawnSync(script, args, {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, ...env },
	});
	return {
		code: r.status ?? -1,
		stdout: r.stdout,
		stderr: r.stderr,
	};
}

// Replace pnpm with a tiny stub on PATH so wt.sh's `exec pnpm` echoes what
// it would have done — lets us assert resolved cwd + args without actually
// running pnpm on a fixture that has no node_modules.
function pnpmStubPath(stubDir: string): string {
	mkdirSync(stubDir, { recursive: true });
	const stub = join(stubDir, "pnpm");
	writeFileSync(stub, '#!/usr/bin/env bash\necho "STUB_PNPM cwd=$PWD args=$*"\n');
	spawnSync("chmod", ["+x", stub]);
	return `${stubDir}${":"}${process.env.PATH ?? ""}`;
}

describe("wt.sh slug resolution (T5/T6/T8)", () => {
	let stubBin: string;

	beforeEach(() => {
		fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
		stubBin = join(fixture.root, "stub-bin");
		// Create two worktrees + leave the trunk as the symlink that fixture made.
		// Use the setup script for realistic resolution behavior.
		const s1 = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
		expect(s1.code, s1.stderr).toBe(0);
		const s2 = run(SETUP_SCRIPT, fixture.workbenchDir, ["repo-beta"]);
		expect(s2.code, s2.stderr).toBe(0);
	});

	describe("T5: resolution", () => {
		it("exact match wins", () => {
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["alpha", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toContain(join(fixture.workbenchDir, "alpha"));
			expect(r.stdout).toContain("[alpha] pnpm hello");
		});

		it("suffix match fallback when no exact match", () => {
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["beta", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toContain(join(fixture.workbenchDir, "repo-beta"));
		});

		it("ambiguous match errors (two -<slug> suffix matches)", () => {
			// Create a second `-beta` worktree to force ambiguity.
			const s3 = run(SETUP_SCRIPT, fixture.workbenchDir, ["other-beta"]);
			expect(s3.code, s3.stderr).toBe(0);
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["beta", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/multiple targets match slug 'beta'/);
			expect(r.stderr).toContain("repo-beta");
			expect(r.stderr).toContain("other-beta");
		});

		it("zero match errors with available targets listed", () => {
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["nope", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/no worktree or trunk matching slug 'nope'/);
			expect(r.stderr).toContain("alpha");
			expect(r.stderr).toContain("repo-beta");
		});
	});

	describe("T6: trunk addressable by wrapped repo name", () => {
		it("`pnpm wt <wrapped_repo>` resolves to the trunk symlink", () => {
			// Fixture's wrapped repo is "clone" — there's a symlink at workbench/clone.
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["clone", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code, r.stderr).toBe(0);
			// wt prints `[<name>] pnpm <cmd>` and exec's pnpm; the stub echoes its
			// cwd. The cwd should be the workbench's `clone` symlink (which itself
			// resolves to the canonical clone dir).
			expect(r.stdout).toContain("[clone] pnpm hello");
		});
	});

	describe("T8: resolved-dir is the worktree, not the trunk (scaffold for Phase 7 ce composition)", () => {
		it("worktree-targeted invocation runs from the worktree dir, not the trunk", () => {
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["alpha", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code, r.stderr).toBe(0);
			// Stub prints `STUB_PNPM cwd=<resolved>`; assert the resolved dir is
			// the alpha worktree, NOT the trunk symlink. (Full ce composition —
			// verifying that ce reads the worktree's .env.local — is the Phase 7
			// manual smoke; this just proves the cwd is right.)
			expect(r.stdout).toMatch(/STUB_PNPM cwd=.*\/alpha\b/);
			expect(r.stdout).not.toContain("STUB_PNPM cwd=" + join(fixture.workbenchDir, "clone"));
		});

		it(":<app> suffix changes cwd to <resolved>/apps/<app>", () => {
			// Add an apps/web/ to the alpha worktree so the :web target resolves.
			mkdirSync(join(fixture.workbenchDir, "alpha", "apps", "web"), {
				recursive: true,
			});
			writeFileSync(
				join(fixture.workbenchDir, "alpha", "apps", "web", "package.json"),
				JSON.stringify({ name: "web", version: "0.0.0" }),
			);
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["alpha:web", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toContain("[alpha/apps/web] pnpm hello");
			expect(r.stdout).toMatch(/STUB_PNPM cwd=.*\/alpha\/apps\/web\b/);
		});

		it(":<app> errors clearly when the app dir doesn't exist", () => {
			const r = run(WT_SCRIPT, fixture.workbenchDir, ["alpha:missing", "hello"], {
				PATH: pnpmStubPath(stubBin),
			});
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/app not found at .*\/alpha\/apps\/missing/);
		});
	});
});

describe("wt-pm2.sh argument parsing (T7 scaffold)", () => {
	beforeEach(() => {
		fixture = buildWorktreeFixture({ worktreeConfig: { trunk_branch: "main" } });
		const s1 = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
		expect(s1.code, s1.stderr).toBe(0);
		// Add apps/web/ to alpha so :web resolves
		mkdirSync(join(fixture.workbenchDir, "alpha", "apps", "web"), {
			recursive: true,
		});
	});

	it("rejects odd-numbered arguments", () => {
		const r = run(WT_PM2_SCRIPT, fixture.workbenchDir, ["alpha", "dev", "extra"], {
			WT_PM2_DRY_RUN: "1",
		});
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/expected an even number of arguments/);
	});

	it("parses one pair and emits the expected process name + cwd (dry-run)", () => {
		const r = run(WT_PM2_SCRIPT, fixture.workbenchDir, ["alpha", "dev"], {
			WT_PM2_DRY_RUN: "1",
		});
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout).toMatch(/→ alpha-dev/);
		expect(r.stdout).toContain(join(fixture.workbenchDir, "alpha"));
		expect(r.stdout).toContain("cmd: pnpm dev");
		expect(r.stdout).toContain("(dry-run: would invoke pm2)");
	});

	it("parses multiple pairs with mixed :<app> suffixes (dry-run)", () => {
		const r = run(WT_PM2_SCRIPT, fixture.workbenchDir, ["alpha:web", "dev", "alpha", "lint"], {
			WT_PM2_DRY_RUN: "1",
		});
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout).toMatch(/→ alpha-web-dev/);
		expect(r.stdout).toMatch(/→ alpha-lint/);
		// Both processes' cwds appear
		expect(r.stdout).toContain(join(fixture.workbenchDir, "alpha", "apps", "web"));
		expect(r.stdout).toContain(join(fixture.workbenchDir, "alpha"));
	});
});

describe("T16-precursor: on_enable hook scaffolds workbench (sanity that the wiring works)", () => {
	it("indusk worktree _on-enable copies scripts + registers pnpm scripts in package.json", () => {
		fixture = buildWorktreeFixture({
			worktreeConfig: { trunk_branch: "main" },
		});
		const cliBin = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
		if (!existsSync(cliBin)) {
			// pnpm build hasn't run; skip rather than fail the suite
			return;
		}
		const r = spawnSync("node", [cliBin, "worktree", "_on-enable"], {
			cwd: fixture.workbenchDir,
			encoding: "utf-8",
		});
		expect(r.status, r.stderr).toBe(0);
		expect(existsSync(join(fixture.workbenchDir, "scripts/worktree/wt.sh"))).toBe(true);
		const pkg = JSON.parse(
			require("node:fs").readFileSync(join(fixture.workbenchDir, "package.json"), "utf-8"),
		) as { scripts?: Record<string, string> };
		expect(pkg.scripts?.wt).toMatch(/scripts\/worktree\/wt\.sh/);
		expect(pkg.scripts?.["wt:pm2"]).toMatch(/scripts\/worktree\/wt-pm2\.sh/);
	});
});
