import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findStrayState } from "../lib/stray-state-audit.js";

/**
 * Phase 4 of workbench-mode-rail-integrity.
 *
 * Sandy's "no lingering app-level state" requirement: workbench-shaped
 * projects should have exactly ONE `.indusk/` directory, at the workbench
 * root. Stray `.indusk/` directories inside the wrapped repo are an
 * artifact of pre-1.31.7 `indusk init` runs that didn't know about
 * workbench mode, OR of operators running `indusk init` from inside the
 * wrapped repo. They silently confuse path resolution.
 *
 * `findStrayState(workbenchRoot)` returns the list of stray directories
 * — each with `path`, `type`, and a recommended cleanup command.
 *
 * T8: stray .indusk/ inside the wrapped repo is detected
 * T9: clean workbench mode (only the workbench-root .indusk/) returns []
 * T10: single-repo mode (no workbench config) returns [] without searching
 * T11: a worktree's own .indusk/ at workbench-root level is NOT flagged
 */

function writeWorkbenchConfig(workbenchRoot: string, wrappedRepo: string): void {
	mkdirSync(join(workbenchRoot, ".indusk"), { recursive: true });
	writeFileSync(
		join(workbenchRoot, ".indusk/config.json"),
		JSON.stringify({ worktree: { wrapped_repo: wrappedRepo } }),
	);
}

function writeSingleRepoConfig(projectRoot: string): void {
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
	writeFileSync(join(projectRoot, ".indusk/config.json"), JSON.stringify({}));
}

describe("Phase 4: stray-state detection", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "stray-state-"));
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	describe("T8: workbench mode detects stray .indusk/ inside the wrapped repo", () => {
		it("flags wrappedRepo/.indusk/ with a recommended cleanup", () => {
			writeWorkbenchConfig(tmpRoot, "numero");
			const wrappedRepo = join(tmpRoot, "numero");
			mkdirSync(wrappedRepo, { recursive: true });
			// Create the stray .indusk/ inside the wrapped repo
			mkdirSync(join(wrappedRepo, ".indusk"), { recursive: true });
			writeFileSync(join(wrappedRepo, ".indusk/config.json"), JSON.stringify({}));

			const stray = findStrayState(tmpRoot);

			expect(stray.length).toBeGreaterThanOrEqual(1);
			const wrappedStray = stray.find((s) => s.path.includes("/numero/.indusk"));
			expect(wrappedStray, "stray inside wrapped repo should be detected").toBeDefined();
			expect(wrappedStray?.type).toBe("wrapped-repo-stray");
			expect(wrappedStray?.recommendation).toMatch(/rm -rf/);
		});
	});

	describe("T9: workbench mode with NO stray state reports clean", () => {
		it("returns empty array when only the canonical workbench .indusk/ exists", () => {
			writeWorkbenchConfig(tmpRoot, "numero");
			const wrappedRepo = join(tmpRoot, "numero");
			mkdirSync(wrappedRepo, { recursive: true });
			// No stray .indusk/ inside wrapped repo

			const stray = findStrayState(tmpRoot);

			expect(stray).toEqual([]);
		});
	});

	describe("T10: single-repo mode does NOT run the audit", () => {
		it("returns empty array without searching when no worktree.wrapped_repo in config", () => {
			writeSingleRepoConfig(tmpRoot);
			// Even if there were stray .indusk/ dirs in subdirs (which wouldn't be
			// stray in single-repo mode anyway), the function should not flag them.
			mkdirSync(join(tmpRoot, "src"), { recursive: true });
			mkdirSync(join(tmpRoot, "src/.indusk"), { recursive: true });

			const stray = findStrayState(tmpRoot);

			expect(stray).toEqual([]);
		});
	});

	describe("T11: worktree at workbench root level is NOT flagged as stray", () => {
		it("a sibling-to-wrapped-repo directory with its own .indusk/ is permitted", () => {
			writeWorkbenchConfig(tmpRoot, "numero");
			const wrappedRepo = join(tmpRoot, "numero");
			mkdirSync(wrappedRepo, { recursive: true });

			// A worktree at the same level as the wrapped repo
			const worktreePath = join(tmpRoot, "feat-something");
			mkdirSync(worktreePath, { recursive: true });
			// Worktrees may legitimately have their own .indusk/ for per-worktree scratch
			mkdirSync(join(worktreePath, ".indusk"), { recursive: true });

			const stray = findStrayState(tmpRoot);

			// The worktree's own .indusk/ should NOT appear in stray output
			const worktreeStray = stray.find((s) => s.path.includes("/feat-something/.indusk"));
			expect(worktreeStray, "worktree-local .indusk/ should NOT be flagged").toBeUndefined();
		});
	});
});
