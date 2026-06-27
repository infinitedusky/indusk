import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `indusk eval baseline --task <path>` is git-only as of 1.31.0
 * (`git-only-substrate` Phase 2). Pre-1.31.0 this command branched on
 * `scm: "jj" | "git"`; T6 in git-or-jj-substrate pinned both branches
 * for parity. After Phase 2 the jj branch is gone; only the git path
 * remains.
 *
 * Runtime end-to-end verification (worktree creation + claude spawn +
 * scorecard write) is covered by the manual smoke at
 * `apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md`.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const EVAL_CLI_PATH = join(REPO_ROOT, "apps/indusk-mcp/src/bin/commands/eval.ts");

describe("eval baseline command — git-only (post-Phase-2 collapse)", () => {
	const source = readFileSync(EVAL_CLI_PATH, "utf-8");

	it("uses git commit --allow-empty to commit the baseline work", () => {
		expect(source).toContain('git commit --allow-empty -m "baseline:');
	});

	it("uses git rev-parse --short HEAD to resolve the baseline change ID", () => {
		expect(source).toContain("git rev-parse --short HEAD");
	});

	it("does NOT shell out to jj for baseline commits", () => {
		expect(source).not.toContain("jj new");
		expect(source).not.toMatch(/jj describe -m "baseline:/);
	});

	it("does NOT shell out to jj log for change ID extraction", () => {
		expect(source).not.toMatch(/jj log -r @[^"]*change_id/);
	});

	it("does NOT import getScm — the SCM abstraction is no longer consumed here", () => {
		expect(source).not.toMatch(/getScm.*from.*lib\/scm/);
		expect(source).not.toMatch(/import.*getScm/);
	});
});
