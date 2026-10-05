import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBriefContract } from "../lib/promises/brief-contract.js";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * planner-promises A20 — the brief template every new plan is handed.
 *
 * A brief is what the planning conversation produced: the expectations and
 * the promises. The why, the context and the findings are research; the
 * direction is the ADR's; and what should be true is said once, as promises,
 * not a second time as success criteria. The planner skill's brief template
 * is what makes that the default, so it is pinned.
 */

function briefTemplate(): string {
	const planner = readFileSync(join(REPO_ROOT, "apps/indusk-mcp/skills/planner.md"), "utf-8");
	const start = planner.indexOf("### brief.md");
	const end = planner.indexOf("### test-plan.md");
	expect(start, "the planner skill has a brief template").toBeGreaterThan(-1);
	expect(end, "followed by the test-plan template").toBeGreaterThan(start);
	return planner.slice(start, end);
}

describe("planner-promises A20 — the planner's brief template", () => {
	it("has Expectations and Promises, with the three lists for existing promises", () => {
		const t = briefTemplate();
		expect(t).toMatch(/^## Expectations$/m);
		expect(t).toMatch(/Measure:/);
		expect(t).toMatch(/Look:/);
		expect(t).toMatch(/^## Promises$/m);
		expect(t).toMatch(/^### This plan makes$/m);
		expect(t).toMatch(/\*\*Must not break\*\*/);
		expect(t).toMatch(/\*\*Changes\*\*/);
		expect(t).toMatch(/\*\*Replaces\*\*/);
		expect(t).toMatch(/^### Not promised$/m);
	});

	it("has no Problem, Proposed Direction or Success Criteria", () => {
		const t = briefTemplate();
		for (const heading of ["## Problem", "## Proposed Direction", "## Success Criteria"]) {
			expect(t, `${heading} belongs to research or the ADR`).not.toContain(heading);
		}
	});

	it("filled in, is read by the contract's own parser with nothing out of shape", () => {
		// The template and the parser are two descriptions of one shape; a
		// template the parser cannot read would hand every new plan a brief
		// its first check refuses.
		const block = /```markdown\n([\s\S]*?)\n```/.exec(briefTemplate())?.[1] ?? "";
		const filled = block
			.replaceAll("{promise-name}", "seat-held-once")
			.replaceAll("{behaviour | state | structure}", "state")
			.replaceAll("{old-name}", "seat-never-double-booked")
			.replaceAll("{new-name}", "seat-held-once")
			// A placeholder is not a measure (A34): the planner fills these in.
			.replace(/- Measure: \{[^}]*\}/, "- Measure: desk calls about stuck seats, per week")
			.replace(/- Look: \{[^}]*\}/, "- Look: two weeks after release");
		const brief = parseBriefContract(filled);
		if (brief.shape !== "contract") throw new Error("the template reads as a legacy brief");
		expect(brief.problems).toEqual([]);
		expect(brief.expectations).toHaveLength(1);
		expect(brief.expectations[0].measure).not.toBeNull();
		expect(brief.expectations[0].look).not.toBeNull();
		expect(brief.makes.map((m) => [m.name, m.kind])).toEqual([["seat-held-once", "state"]]);
		expect(brief.mustNotBreak).toEqual(["seat-held-once"]);
		expect(brief.changes.map((c) => c.name)).toEqual(["seat-held-once"]);
		expect(brief.replaces).toEqual([{ old: "seat-never-double-booked", by: "seat-held-once" }]);
	});

	it("keeps Depends On and Blocks, which /work reads there", () => {
		const t = briefTemplate();
		expect(t).toMatch(/^## Depends On$/m);
		expect(t).toMatch(/^## Blocks$/m);
	});
});
