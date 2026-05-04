import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T6 — `indusk eval baseline --task <path>` on a git-mode project succeeds.
 *
 * The runtime end-to-end verification (worktree creation + claude spawn +
 * scorecard write) is covered by T8 (manual smoke) — that path requires the
 * `claude` CLI and is too heavy to run automatically.
 *
 * This test verifies the structural fix: the baseline command's source
 * contains BOTH SCM branches in its commit-and-changeId code paths. Without
 * the git branch, calling baseline against a git-only worktree fails at the
 * `jj new` shell-out (today's behavior).
 *
 * Pairs with the runtime smoke at `apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md`
 * (Phase 5).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const EVAL_CLI_PATH = join(REPO_ROOT, "apps/indusk-mcp/src/bin/commands/eval.ts");

describe("eval baseline command — SCM branches (T6)", () => {
	const source = readFileSync(EVAL_CLI_PATH, "utf-8");

	it("contains a git commit --allow-empty branch for git-mode baselines", () => {
		expect(source).toContain('git commit --allow-empty -m "baseline:');
	});

	it("contains a jj new + jj describe branch for jj-mode baselines", () => {
		expect(source).toContain("jj new");
		expect(source).toContain('jj describe -m "baseline:');
	});

	it("contains a git rev-parse --short HEAD branch for git-mode change IDs", () => {
		expect(source).toContain("git rev-parse --short HEAD");
	});

	it("contains a jj log change_id branch for jj-mode change IDs", () => {
		expect(source).toMatch(/jj log -r @[^"]*change_id/);
	});

	it("imports getScm from lib/scm/detect.js (static or dynamic import)", () => {
		expect(source).toMatch(/getScm.*['"][.][./]+lib\/scm\/detect/);
	});
});
