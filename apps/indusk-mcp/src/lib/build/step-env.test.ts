// promise: a-plan-is-read-cold-before-approval
import { describe, expect, it } from "vitest";
import { PLANNING_STEPS, planningStepRefusal } from "./step-env.js";

// clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold
describe("A22 — the plan review is a planning step, so approving is refused inside it", () => {
	it("lists plan-review among the planning steps", () => {
		expect(PLANNING_STEPS).toContain("plan-review");
	});
	it("refuses approving from inside it", () => {
		expect(planningStepRefusal("approving", { INDUSK_BUILD_STEP: "plan-review" })).not.toBeNull();
	});
});
