import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Phase 3 of context-budget (1.31.11). Source-grep regression tests
 * defending the one-line Current State discipline against future skill
 * drift.
 *
 * The discipline is: when /retrospective adds a Current State entry for a
 * newly-completed plan, it writes ONE LINE + a link to the archive, not a
 * multi-paragraph prose entry. Multi-paragraph entries accreted in CLAUDE.md
 * are the primary token-bloat driver — over 20-30 plans, Current State alone
 * pushes CLAUDE.md past 30KB always-loaded.
 *
 * T9: retrospective skill source contains the "one-line entry" / "one line
 *     plus a link" guidance for Current State
 * T10: skill contains a counter-example block warning AGAINST multi-
 *      paragraph entries with rationale
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = resolve(__dirname, "../../skills/retrospective.md");

describe("Phase 3: retrospective skill one-line Current State discipline (1.31.11)", () => {
	const source = readFileSync(SKILL_PATH, "utf-8");

	describe("T9: skill documents the one-line shape for Current State entries", () => {
		it("Step 7 (Context Audit) names the one-line discipline explicitly", () => {
			// Find Step 7's body
			const step7Idx = source.indexOf("### Step 7: Context Audit");
			const step8Idx = source.indexOf("### Step 8");
			expect(step7Idx, "Step 7 heading exists").toBeGreaterThan(-1);
			expect(step8Idx, "Step 8 heading exists").toBeGreaterThan(step7Idx);
			const step7Body = source.slice(step7Idx, step8Idx);

			// The discipline is documented with explicit phrasing
			expect(step7Body, "Step 7 should contain 'one-line' or 'one line'").toMatch(
				/one[- ]line/i,
			);
			expect(step7Body, "Step 7 should mention 'link to archive'").toMatch(
				/link to (the )?archive|See \[archive\]/i,
			);
		});

		it("skill includes an example of the right Current State shape", () => {
			// Must show what to do, not just say "do this"
			expect(source, "concrete example with markdown code-block").toMatch(
				/\*\*\{plan-name\}.*\(\{version\}\)\*\*/i,
			);
			expect(source, "example references archive path").toMatch(
				/\.indusk\/planning\/archive\//,
			);
		});
	});

	describe("T10: skill includes a counter-example warning against multi-paragraph entries", () => {
		it("explicitly warns against the multi-paragraph shape with rationale", () => {
			// "Counter-example" or "do NOT" or "instead of" phrasing
			expect(source, "warns explicitly against the bloat shape").toMatch(
				/counter[- ]example|do NOT write|don't write/i,
			);
		});

		it("explains the rationale — token cost on every catchup", () => {
			// The WHY is load-bearing — without it, operators may revert to paragraph entries
			expect(source, "rationale references token cost / catchup / bloat").toMatch(
				/token bloat|every catchup|always-loaded|context bloat/i,
			);
		});

		it("references the context-budget plan for full rationale", () => {
			expect(source).toMatch(/context-budget/i);
		});
	});
});
