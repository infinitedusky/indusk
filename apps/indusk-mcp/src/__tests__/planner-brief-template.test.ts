import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

	it("keeps Depends On and Blocks, which /work reads there", () => {
		const t = briefTemplate();
		expect(t).toMatch(/^## Depends On$/m);
		expect(t).toMatch(/^## Blocks$/m);
	});
});
