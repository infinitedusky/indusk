// clause: what-was-agreed-is-never-cheap/never-timed-out
import { describe, expect, it } from "vitest";
import { changesAgreed, effectiveCost } from "./cost.js";

const opt = (label: string, changes: ("brief" | "promise" | "look" | "gate")[] = []) => ({
	label,
	changes,
});
const q = (over = {}) => ({
	options: [opt("a"), opt("b")],
	recommended: "a",
	reason: "r",
	cost: "cheap" as const,
	askedAt: 0,
	...over,
});

describe("questions — the cost", () => {
	it("T11 — raised to expensive when an option changes what was agreed, never lowered", () => {
		for (const what of ["brief", "promise", "look", "gate"] as const) {
			const raised = q({ options: [opt("a", [what]), opt("b")] });
			expect(effectiveCost(raised)).toBe("expensive");
			expect(changesAgreed(raised)).toBe(true);
		}
		expect(effectiveCost(q({ cost: "moderate" }))).toBe("moderate");
		expect(effectiveCost(q({ cost: "expensive" }))).toBe("expensive");
		expect(changesAgreed(q())).toBe(false);
	});
});
