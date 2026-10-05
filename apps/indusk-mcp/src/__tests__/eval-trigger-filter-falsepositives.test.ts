import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

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

	it("filters with the shared command-position reading, not a regex of its own", () => {
		// As of 1.31.0 (`git-only-substrate` Phase 2) the filter narrowed to
		// match only the user-facing porcelain `git commit`. Phase 6 (falsi-
		// fication fix for H5) further tightened the right edge — `\b` matches
		// `t`→`-` (word-char to non-word), which would let `git commit-tree`
		// fire the hook. The right edge now uses a lookahead like
		// `(?=$|\s|;|&|\|)`. We assert the left-edge `\b` is still there as
		// the substring-defense floor; the per-command negative cases live
		// in the T16 group below.
		//
		// Since day-monitor A32 (2026-10-05) the filter is trunk-guard's
		// `COMMIT_RE`, shared through `_commit-anchor.js`: `git` in command
		// position, which is a stricter left edge than `\b` (a quoted
		// `"git commit"` is not a command), and `git -C <dir> commit` counts.
		expect(source).toMatch(/import \{[^}]*\bCOMMIT_RE\b[^}]*\} from "\.\/_commit-anchor\.js"/);
		expect(source).toMatch(/TRIGGER_RE = COMMIT_RE/);
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

describe("eval-trigger.js — TRIGGER_RE does not match git plumbing commands (T16)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	// The regex the hook uses — imported from the shared module it imports, so
	// the assertions exercise it rather than a re-typed copy.
	let commitRe: RegExp;
	beforeAll(async () => {
		// @ts-expect-error — a plain-JS hook module, no type declarations
		({ COMMIT_RE: commitRe } = await import("../../hooks/_commit-anchor.js"));
	});
	function extractTriggerRe(): RegExp {
		expect(source).toMatch(/TRIGGER_RE = COMMIT_RE/);
		return new RegExp(commitRe.source, commitRe.flags);
	}

	it("matches the porcelain `git commit` (regression: don't break the happy path)", () => {
		const re = extractTriggerRe();
		expect(re.test('git commit -m "msg"')).toBe(true);
		expect(re.test("git commit")).toBe(true);
		expect(re.test("git commit --allow-empty -m 'baseline'")).toBe(true);
	});

	it("does NOT match `git commit-tree` plumbing command (the regex's right-edge word boundary currently matches `t`→`-`)", () => {
		const re = extractTriggerRe();
		expect(re.test("git commit-tree HEAD^{tree}")).toBe(false);
		expect(re.test("git commit-tree write-tree")).toBe(false);
	});

	it("does NOT match `git commit-graph` plumbing command", () => {
		const re = extractTriggerRe();
		expect(re.test("git commit-graph write")).toBe(false);
		expect(re.test("git commit-graph verify")).toBe(false);
	});

	it("still rejects non-commit `git` commands that happen to contain `commit` as a substring", () => {
		// `git config user.email "git committer"` — pre-existing word-boundary
		// defense, must still hold after the right-edge tightening.
		const re = extractTriggerRe();
		expect(re.test('git config user.email "git committer"')).toBe(false);
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
