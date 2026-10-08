import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * small-fixes — A6, A15: the planner skill ends at the written plan.
 *
 * A planning session once set a plan `in-progress` itself and started
 * building, so `plans approve` never ran (known-issues, 2026-10-06). The gate
 * (`check-gates.js`, A4–A5) refuses that now; the skill must not ask for it
 * either. And the Key Decisions line the planner used to write to the root
 * `CLAUDE.md` at ADR acceptance made `plans approve` refuse the branch for a
 * change outside `.indusk/` (known-issues, "Approve and the planner
 * disagree"); it is a first-build-phase Context item instead.
 *
 * promise: a-plan-builds-only-after-approval
 */

const PLANNER = resolve(__dirname, "../../skills/planner.md");
const text = readFileSync(PLANNER, "utf-8");
const steps = text.slice(text.indexOf("## What to Do When Asked to Plan"));

describe("A6 — the planner ends at the written plan", () => {
	it("names `indusk plans approve` as the way a plan is approved", () => {
		expect(steps).toMatch(
			/run `indusk plans approve <name>` rather than setting the status by hand/,
		);
	});
	it("never tells the agent to set a plan in progress or to start building", () => {
		const offending = steps
			.split("\n")
			.filter((l) => /\b(set|change|mark|flip)\b[^\n]{0,40}`?in-progress`?/i.test(l));
		expect(offending).toEqual([]);
		expect(steps).not.toMatch(/start (building|implementing|the build)/i);
	});
});

describe("A15 — the Key Decisions line is the first build phase's, not ADR acceptance's", () => {
	it("no longer tells the agent to edit the root CLAUDE.md when the ADR is accepted", () => {
		expect(steps).not.toMatch(/After the ADR is accepted\*\*, add a one-liner to CLAUDE\.md/);
	});
	it("tells the agent to give the first build phase a Context item for the Key Decisions line", () => {
		expect(steps).toMatch(/first build phase[^\n]{0,80}Context item[^\n]{0,80}Key Decisions/i);
	});
});
