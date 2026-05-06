import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T16 + T17 — Phase 7 falsification fixes against `eval-trigger.js`.
 *
 * - T16: trigger filter must use a word-boundary regex so substring
 *   false-positives like `git config user.email "git committer"` or
 *   `cat git-commit-template.md` don't fire the hook.
 * - T17: hook reads `event.tool_response.exit_code` (or equivalent) and
 *   skips when non-zero, so failed commits don't trigger eval against
 *   stale state.
 *
 * RED AT PHASE 7 START. Today the filter uses `command.includes(p)`
 * substring matching and the hook ignores tool_response entirely.
 *
 * Source-level tests — same approach as `eval-trigger-git-mode.test.ts`
 * (the hook is a single short script; pattern is purely textual).
 */

const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");

describe("eval-trigger.js — word-boundary trigger filter (T16)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("uses a regex with word boundaries (\\b) for the trigger filter", () => {
		// After H3 the filter should be a regex like /\b(jj describe|git commit)\b/.
		// We don't pin the exact source shape; we just require the filter to
		// use \b as a boundary anchor.
		expect(source).toMatch(/\\b\(?jj describe[\s\S]*git commit[\s\S]*\)?\\b/);
	});

	it("does NOT use String.includes for the trigger check (the pre-Phase-7 shape)", () => {
		// Pre-fix shape was `triggerPatterns.some((p) => command.includes(p))`.
		// After fix the includes-on-trigger-pattern call should be gone — there
		// should be no `command.includes("git commit")` or `command.includes("jj describe")`
		// remaining (the regex test replaces both).
		expect(source).not.toMatch(/command\.includes\("git commit"\)/);
		expect(source).not.toMatch(/command\.includes\("jj describe"\)/);
		// Also: the array-of-patterns-with-some pattern should be gone.
		expect(source).not.toMatch(/triggerPatterns\.some\(/);
	});
});

describe("eval-trigger.js — failed-commit exit_code skip (T17)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("reads tool_response.exit_code from the hook event and skips when non-zero", () => {
		// After H4 the hook reads `event.tool_response?.exit_code` (or similar
		// property access) and exits early when it's non-zero. The exact shape
		// isn't pinned — any read of `tool_response` + `exit_code` near a
		// process.exit(0) is acceptable.
		expect(source).toMatch(/tool_response/);
		expect(source).toMatch(/exit_code/);
	});

	it("syslogs a failed-bash-command skip reason", () => {
		// After H4 the syslog message names the failed-command skip path,
		// distinct from the trigger-filter skip ("skip — no jj describe / git commit").
		expect(source).toMatch(/skip[^"]*(?:failed|exit_code)/i);
	});
});
