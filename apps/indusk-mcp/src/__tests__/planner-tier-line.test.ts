import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What this pins (plan-review-subagent A13): the planner writes a
 * `**Tier**:` line under every phase it authors. It is the step
 * model-per-phase decided ("the planner decides each phase's model when it
 * writes the phase") and never landed. Not a promise's test: prose has no
 * other test, so this reads the three places the rule must live as text —
 * the planner skill's impl step, the shipped planning rules, and the impl
 * template inside the planner skill.
 */

const PKG = resolve(__dirname, "../..");
const planner = readFileSync(join(PKG, "skills/planner.md"), "utf-8");
const planningRules = readFileSync(join(PKG, "templates/planning/CLAUDE.md"), "utf-8");

/** The text from `start` up to (not including) the next `end` after it. */
function between(text: string, start: RegExp, end: RegExp): string {
	const from = text.search(start);
	expect(from, `no match for ${start}`).toBeGreaterThanOrEqual(0);
	const rest = text.slice(from + 1);
	const to = rest.search(end);
	return to === -1 ? rest : rest.slice(0, to);
}

describe("plan-review-subagent A13 — the planner writes a Tier line under every phase", () => {
	it("the planner skill's impl step (7) says every phase carries a **Tier** line", () => {
		const step7 = between(planner, /^7\. \*\*If ADR is accepted\*\*/m, /^8\. /m);
		expect(step7).toContain("**Tier**:");
		expect(step7).toMatch(/every phase/i);
	});

	it("the planning rules say every phase names its tier, not that it may", () => {
		const rule = between(planningRules, /\*\*Tier\*\*/, /^- \*\*/m);
		expect(planningRules).toMatch(/every phase[^.]*\*\*Tier\*\*|\*\*Tier\*\*[^.]*every phase/i);
		expect(rule).not.toMatch(/may carry/i);
	});

	it("the impl template carries a **Tier** line under each phase heading", () => {
		for (const heading of [/^### Test Phase 1: \{/m, /^### Build Phase 1: \{/m]) {
			const underHeading = between(planner, heading, /^- \[ \]|^####/m);
			expect(underHeading, `${heading} has no Tier line before its first item`).toContain(
				"**Tier**:",
			);
		}
	});
});
