import { describe, expect, it } from "vitest";
import { isActivePlanStatus } from "./plan-tools.js";

/**
 * A17 (indusk-makeover Phase 7 falsification): the `list_plans { active: true }`
 * filter must include plans whose most-advanced doc is `completed` — a
 * completed impl still inside planning/ is by definition awaiting the
 * close-out rituals (falsify/cleanup/retrospective). Only archival (moving to
 * planning/archive/) removes a plan from the active list.
 */
describe("isActivePlanStatus (A17)", () => {
	it("includes completed — plans awaiting close-out are active", () => {
		expect(isActivePlanStatus("completed")).toBe(true);
	});

	for (const status of ["accepted", "approved", "in-progress", "proposed"]) {
		it(`includes ${status}`, () => {
			expect(isActivePlanStatus(status)).toBe(true);
		});
	}

	for (const status of ["draft", "complete", "", "abandoned", "superseded"]) {
		it(`excludes ${status || "(empty)"}`, () => {
			expect(isActivePlanStatus(status)).toBe(false);
		});
	}
});
