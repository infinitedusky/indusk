import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T15 — `apps/indusk-mcp/src/bin/commands/init.ts` syncs ALL `.js` files
 * from the package's `hooks/` directory rather than a hardcoded list.
 *
 * RED AT PHASE 6 START. Today init's hook copy uses a hardcoded array
 * `["check-gates.js", "gate-reminder.js", "validate-impl-structure.js",
 * "check-catchup.js"]` — `eval-trigger.js` is missing. Settings.json
 * registers `node .claude/hooks/eval-trigger.js` but the file isn't
 * copied, so the hook never fires on fresh init projects (file-not-found
 * silently fails).
 *
 * `update.ts` already uses `globSync("*.js", { cwd: hooksSource })`;
 * Phase 6 H1-C aligns init.ts to the same pattern.
 *
 * Source-level test: assert the file uses globSync near the hook copy
 * block AND does not still have a hardcoded list missing eval-trigger.
 */

const INIT_PATH = resolve(__dirname, "../bin/commands/init.ts");

describe("init.ts syncs hooks via globSync (T15)", () => {
	const source = readFileSync(INIT_PATH, "utf-8");

	it("uses globSync to discover hook files (matching update.ts's pattern)", () => {
		// After H1-C, init's hook installation block should call
		// globSync("*.js", { cwd: hooksSource }) — same as update.ts:240.
		// Find the section that mentions "[Hooks]" or hooks installation,
		// then check globSync is used in that vicinity.
		const hooksSectionIdx = source.indexOf("// 8. Install gate enforcement hooks");
		expect(hooksSectionIdx, "hooks install section should exist").toBeGreaterThan(-1);
		// Window from "// 8." until ~600 chars later should contain globSync
		const window = source.slice(hooksSectionIdx, hooksSectionIdx + 800);
		expect(window).toMatch(/globSync\s*\(\s*['"`]\*\.js['"`]/);
	});

	it("does not have a hardcoded hookFiles array missing eval-trigger.js", () => {
		// The pre-fix shape was a literal array of 4 hook filenames omitting
		// eval-trigger. After fix, the hardcoded array is gone (replaced by
		// globSync). The most precise check: if any literal `["check-gates.js",
		// ..., "check-catchup.js"]`-style array exists, eval-trigger.js must
		// be in it. Simpler proxy: there should be no hardcoded list of
		// hook filenames at all.
		const hardcoded = source.match(
			/const hookFiles\s*=\s*\[\s*"check-gates\.js"[^\]]*\]/,
		);
		if (hardcoded) {
			// Old hardcoded shape exists — must include eval-trigger
			expect(hardcoded[0]).toContain("eval-trigger.js");
		}
	});
});
