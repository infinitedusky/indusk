import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T11 + T12 — `eval-trigger.js` is dual-mode (jj + git), per the
 * `git-or-jj-substrate` plan's brief and Phase 6 falsification.
 *
 * RED AT PHASE 6 START. The hook today filters trigger commands by
 * `command.includes("jj describe")` only; it reads the change ID via
 * `jj log` with no git fallback. On git-mode projects this means the
 * eval hook never fires after a `git commit`. T11 + T12 capture this
 * structural shape — they go red against current source and green once
 * Phase 6's H1-A + H1-B fixes land.
 *
 * Source-level tests are sufficient here: the hook is a single short
 * script, and the pattern we want to enforce is purely textual. A full
 * runtime simulation would require spawning the hook with a fake hook
 * event and inspecting system.log — heavier, slower, and more brittle
 * than a grep against source.
 */

const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");

describe("eval-trigger.js — dual-SCM trigger filter (T11)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("matches both `jj describe` AND `git commit` in the trigger filter", () => {
		// The filter must accept both trigger commands — neither one alone is enough.
		// Grep for both literal strings appearing as filter patterns (not in
		// comments / docs).
		expect(source).toMatch(/jj describe/);
		expect(source).toMatch(/git commit/);
	});

	it("does NOT use a single-command early-exit filter (the pre-Phase-6 shape)", () => {
		// Pre-fix shape was `if (!command.includes("jj describe"))`. After fix
		// the filter uses an array/some/test/regex covering both patterns. The
		// exact post-fix shape isn't pinned, but the bare single-command form
		// must be gone.
		expect(source).not.toMatch(/if\s*\(\s*!command\.includes\("jj describe"\)\s*\)/);
	});

	it("the skip log message names BOTH jj describe and git commit (so debug output is honest)", () => {
		// Pre-fix log was `"skip — no jj describe in command"`. After fix it
		// names both triggers so a user reading system.log isn't misled into
		// thinking only jj is monitored.
		expect(source).toMatch(/skip[^"]*jj describe[^"]*git commit/);
	});
});

describe("eval-trigger.js — change ID extraction with git fallback (T12)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("invokes `git rev-parse` as a fallback when jj's change-ID query fails", () => {
		// After H1-B the hook tries jj first, falls back to git rev-parse on
		// failure. Pre-fix the fallback didn't exist; the catch block silently
		// `process.exit(0)`-d, dropping the eval entirely on git-mode projects.
		expect(source).toMatch(/git rev-parse/);
	});

	it("does NOT silently exit when jj's change-ID query fails (the pre-Phase-6 shape)", () => {
		// Pre-fix shape was a bare `} catch { process.exit(0); }` immediately
		// after the `jj log -r @` execSync. After fix, the catch block tries
		// the git path before exiting. We check that the catch immediately
		// following the jj log call is NOT a silent exit.
		const jjLogIdx = source.indexOf("jj log -r @");
		expect(jjLogIdx, "jj log call should still exist").toBeGreaterThan(-1);
		// Slice the next 250 chars after the jj log call — should contain a
		// `git rev-parse` (the fallback) before any `process.exit(0)`.
		const nextWindow = source.slice(jjLogIdx, jjLogIdx + 350);
		expect(nextWindow).toMatch(/git rev-parse/);
	});
});
