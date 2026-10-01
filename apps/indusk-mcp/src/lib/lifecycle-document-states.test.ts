import { describe, expect, it } from "vitest";
import { derivePlanPosition } from "./lifecycle.js";
import type { PlanSummary } from "./plan-parser.js";

/**
 * admin-plan-type — A5–A9.
 *
 * The plan bar called every absent earlier document `skipped`, whatever the
 * plan was. A bugfix that never needed research and a bugfix that closed
 * without its test plan drew the same dashed segment, so the bar asserted a
 * judgment ("this was skipped by design") it had never made.
 *
 * The plan's declared type makes the judgment: a document the type does not
 * require is skipped; one it requires and the plan moved past is missing; one
 * it requires and has not reached is pending; and with no type declared an
 * absent earlier document is unknown.
 *
 * States are compared as strings on purpose: `missing` and `unknown` are not
 * members of the segment-state union until Build Phase 1, and a test that only
 * fails to type-check has not been authored.
 */

type Summary = PlanSummary & { workflow?: string | null };

function plan(over: Partial<Summary>): PlanSummary {
	return {
		name: "demo",
		stage: "impl",
		stageStatus: "in-progress",
		nextStep: "",
		dependencies: [],
		documents: [],
		...over,
	} as PlanSummary;
}

function segments(summary: PlanSummary, archived = false): Record<string, string> {
	const state = derivePlanPosition({ summary, impl: null, readiness: null, archived });
	return state.segments as Record<string, string>;
}

describe("A5 — a bugfix's research and ADR read skipped, behind and ahead", () => {
	it("behind: a bugfix executing its impl reads the absent research and ADR as skipped", () => {
		const s = segments(
			plan({ workflow: "bugfix", documents: ["brief.md", "test-plan.md", "impl.md"] }),
		);
		expect(s.research).toBe("skipped");
		expect(s.adr).toBe("skipped");
	});

	it("ahead: a bugfix still at its brief already reads the ADR as skipped, not pending", () => {
		const s = segments(
			plan({
				workflow: "bugfix",
				stage: "brief",
				stageStatus: "accepted",
				documents: ["brief.md"],
			}),
		);
		expect(s.research).toBe("skipped");
		expect(s.adr).toBe("skipped");
	});
});

describe("A6 — a bugfix that moved past an absent test plan reads it missing", () => {
	it("an impl exists and the test plan does not: missing, not skipped", () => {
		const s = segments(plan({ workflow: "bugfix", documents: ["brief.md", "impl.md"] }));
		expect(s["test-plan"]).toBe("missing");
	});

	it("an archived bugfix that closed without one still reads it missing", () => {
		const s = segments(
			plan({
				workflow: "bugfix",
				stageStatus: "completed",
				documents: ["brief.md", "impl.md", "retrospective.md"],
			}),
			true,
		);
		expect(s["test-plan"]).toBe("missing");
		expect(s.research).toBe("skipped");
		expect(s.adr).toBe("skipped");
	});
});

describe("A7 — a required document the plan has not reached reads pending", () => {
	it("a bugfix at its brief with no test plan yet: pending, never missing", () => {
		const s = segments(
			plan({
				workflow: "bugfix",
				stage: "brief",
				stageStatus: "accepted",
				documents: ["brief.md"],
			}),
		);
		expect(s["test-plan"]).toBe("pending");
		expect(s["impl-approved"]).toBe("pending");
	});
});

describe("A8 — with no type declared, an absent earlier document is unknown", () => {
	it("an untyped plan past an absent research and ADR reads them unknown, never skipped", () => {
		const s = segments(plan({ documents: ["brief.md", "test-plan.md", "impl.md"] }));
		expect(s.research).toBe("unknown");
		expect(s.adr).toBe("unknown");
	});

	it("an explicit null type is the same as none", () => {
		const s = segments(plan({ workflow: null, documents: ["brief.md", "impl.md"] }));
		expect(s.research).toBe("unknown");
		expect(s["test-plan"]).toBe("unknown");
	});

	it("documents an untyped plan has not reached yet still read pending", () => {
		const s = segments(plan({ stage: "brief", stageStatus: "draft", documents: ["brief.md"] }));
		expect(s["test-plan"]).toBe("pending");
		expect(s.adr).toBe("pending");
	});
});

describe("A9 — a feature plan with every document present reads as it did", () => {
	it("typed or not, nothing absent means nothing to judge", () => {
		const documents = ["research.md", "brief.md", "test-plan.md", "adr.md", "impl.md"];
		const untyped = segments(plan({ documents }));
		const typed = segments(plan({ workflow: "feature", documents }));
		expect(typed).toEqual(untyped);
		for (const position of ["research", "brief", "test-plan", "adr", "impl-approved"]) {
			expect(typed[position]).toBe("done");
		}
		expect(typed.executing).toBe("active");
		expect(typed.retrospective).toBe("pending");
	});
});
