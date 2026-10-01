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

/**
 * A21, A22 (falsification). The type judged an absent *document* and nothing
 * else. Printed for this repository's own spikes: brief through retrospective
 * read skipped while executing, falsify and cleanup read pending — steps that
 * exist only because of an impl the type says there will never be — and a
 * spike whose research was finished was said to be awaiting the next document.
 */
function state(summary: PlanSummary, archived = false) {
	return derivePlanPosition({ summary, impl: null, readiness: null, archived });
}

describe("A21 — a type with no impl skips the positions that follow one", () => {
	const IMPL_DEPENDENT = ["executing", "falsify", "cleanup"];

	it("a spike in progress reads executing, falsify and cleanup as skipped, not pending", () => {
		const s = segments(
			plan({
				workflow: "spike",
				stage: "research",
				stageStatus: "in-progress",
				documents: ["research.md"],
			}),
		);
		for (const position of IMPL_DEPENDENT) expect(s[position]).toBe("skipped");
		expect(s["impl-approved"]).toBe("skipped");
	});

	it("an archived spike reads them as skipped, never done", () => {
		const s = segments(
			plan({
				workflow: "spike",
				stage: "research",
				stageStatus: "complete",
				documents: ["research.md"],
			}),
			true,
		);
		for (const position of IMPL_DEPENDENT) expect(s[position]).toBe("skipped");
		expect(s.research).toBe("done");
	});

	it("a type that has an impl is unchanged: pending ahead, done behind", () => {
		const ahead = segments(
			plan({
				workflow: "bugfix",
				stage: "brief",
				stageStatus: "accepted",
				documents: ["brief.md"],
			}),
		);
		for (const position of IMPL_DEPENDENT) expect(ahead[position]).toBe("pending");
		const behind = segments(
			plan({
				workflow: "bugfix",
				stageStatus: "completed",
				documents: ["brief.md", "test-plan.md", "impl.md", "retrospective.md"],
			}),
			true,
		);
		for (const position of IMPL_DEPENDENT) expect(behind[position]).toBe("done");
	});

	it("a plan with no declared type is unchanged", () => {
		const s = segments(
			plan({ stage: "research", stageStatus: "in-progress", documents: ["research.md"] }),
		);
		for (const position of IMPL_DEPENDENT) expect(s[position]).toBe("pending");
	});
});

describe("A22 — a finished document with nothing required after it does not await one", () => {
	it("a spike whose research is complete says the plan ends there", () => {
		const s = state(
			plan({
				workflow: "spike",
				stage: "research",
				stageStatus: "complete",
				documents: ["research.md"],
			}),
		);
		expect(s.awaiting ?? "").not.toMatch(/next document/);
		expect(s.awaiting ?? "").toMatch(/spike/);
	});

	it("a bugfix with an accepted brief still awaits the next document", () => {
		const s = state(
			plan({
				workflow: "bugfix",
				stage: "brief",
				stageStatus: "accepted",
				documents: ["brief.md"],
			}),
		);
		expect(s.awaiting ?? "").toMatch(/awaiting the next document/);
	});

	it("an untyped plan's finished research reads as it does today", () => {
		const s = state(
			plan({ stage: "research", stageStatus: "complete", documents: ["research.md"] }),
		);
		expect(s.awaiting ?? "").toMatch(/awaiting the next document/);
	});
});
