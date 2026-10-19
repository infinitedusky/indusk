// promise: nothing-ships-until-accepted
// promise: an-unclaimed-failure-opens-a-bugfix-plan
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bugfixPlanName } from "../release/bugfix-plan.js";
import { followOnName } from "./follow-on.js";

/**
 * decisions-as-questions T18: a plan with questions open is no more or less accepted
 * than the same plan without, and a follow-on sits beside the bugfix plan an unclaimed
 * failure opens, never in its place.
 */
describe("T18 — questions and acceptance are separate; a follow-on is not a bugfix plan", () => {
	it("acceptance, approval and landing never read a question", () => {
		const plans = new URL("../plans/", import.meta.url).pathname;
		for (const file of ["accept.ts", "approve.ts", "land.ts"]) {
			expect(readFileSync(join(plans, file), "utf-8"), file).not.toMatch(/questions\//);
		}
	});

	it("a follow-on's name never collides with a bugfix plan's", () => {
		expect(followOnName({ plan: "seat-holds", id: "q-1" })).toBe("seat-holds-q-1");
		expect(bugfixPlanName("src/seat.test.ts").startsWith("fix-")).toBe(true);
		expect(followOnName({ plan: "fix-seat", id: "q-1" })).not.toBe(
			bugfixPlanName("src/seat.test.ts"),
		);
	});
});
