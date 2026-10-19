import { describe, expect, it } from "vitest";
import { derivePlanPosition, type PlanPositionState } from "../lifecycle.js";
import { type PlanSnapshot, planSteps, stepAt } from "./steps.js";

// clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step
// clause: a-run-is-read-from-its-record/never-in-progress-when-idle

/**
 * a-run-can-be-trusted, Build Phase 2. A72: the planning steps end with the
 * Planning audit, after the impl, and its order holds (the page never asks for
 * approval while the audit is open). A81: a planning step, and the audit, read in
 * progress only while a live planning process runs for the plan.
 */

function position(stage: "impl" | "adr", stageStatus: string): PlanPositionState {
	return derivePlanPosition({
		summary: {
			name: "p",
			stage,
			stageStatus,
			nextStep: "",
			dependencies: [],
			documents: ["research.md", "brief.md", "test-plan.md", "adr.md", "impl.md"],
		},
		impl: null,
		readiness: {
			missing: [],
			nonTerminalRows: [],
			unprovenPromises: [],
			longSkipReasons: [],
		} as never,
		archived: false,
	});
}

const draft = (over: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
	workflow: "feature",
	position: position("impl", "draft"),
	documents: {
		research: { status: "accepted" },
		brief: { status: "accepted" },
		"test-plan": { status: "accepted" },
		adr: { status: "accepted" },
		impl: { status: "draft" },
	},
	...over,
});

const states = (steps: { name: string; state: string }[]) =>
	Object.fromEntries(steps.map((s) => [s.name, s.state]));

describe("A72 — the planning steps end with the Planning audit", () => {
	it("A72 reads Research, Brief, Test plan, Decision, Impl, Planning audit in order", () => {
		const { planning } = planSteps(draft({ planReview: "missing" }));
		expect(planning.map((s) => s.name)).toEqual([
			"Research",
			"Brief",
			"Test plan",
			"Decision",
			"Impl",
			"Planning audit",
		]);
	});

	it("A72 the audit is in progress while the plan-review step runs", () => {
		const { planning } = planSteps(
			draft({ planReview: "missing", live: { writing: true, planningStep: "plan-review" } }),
		);
		expect(states(planning)["Planning audit"]).toBe("current");
	});

	it("A72 the audit is to do when the review is missing or unanswered and nothing runs", () => {
		for (const planReview of ["missing", "unanswered"] as const) {
			const { planning } = planSteps(draft({ planReview, live: {} }));
			expect(states(planning)["Planning audit"]).toBe("not-yet");
		}
	});

	it("A72 the audit is done once the review is answered, and only then does Impl ask for approval", () => {
		const { planning } = planSteps(draft({ planReview: "answered", live: {} }));
		expect(states(planning)["Planning audit"]).toBe("done");
		expect(states(planning).Impl).toBe("needs-you");
	});

	it("A72 while the audit is open stepAt names it, never the Impl step asking for approval", () => {
		const open = stepAt(draft({ planReview: "unanswered", live: {} }));
		expect(open?.name).toBe("Planning audit");
		const running = stepAt(
			draft({ planReview: "missing", live: { writing: true, planningStep: "plan-review" } }),
		);
		expect(running?.name).toBe("Planning audit");
		const answered = stepAt(draft({ planReview: "answered", live: {} }));
		expect(answered?.name).toBe("Impl");
	});

	it("A72 an approved impl has done its audit", () => {
		const { planning } = planSteps(
			draft({
				position: position("impl", "approved"),
				documents: { ...draft().documents, impl: { status: "approved" } },
				planReview: "missing",
			}),
		);
		expect(states(planning)["Planning audit"]).toBe("done");
	});

	it("A72 a plan type with no impl shows no Planning audit", () => {
		const { planning } = planSteps({
			workflow: "spike",
			position: position("adr", "proposed"),
			documents: { research: { status: "accepted" } },
		});
		expect(planning.map((s) => s.name)).not.toContain("Planning audit");
	});
});

describe("A81 — a planning step reads in progress only while a process runs for it", () => {
	const writingDraft = (over: Partial<PlanSnapshot>): PlanSnapshot =>
		draft({
			position: position("adr", "draft"),
			documents: {
				research: { status: "accepted" },
				brief: { status: "accepted" },
				"test-plan": { status: "accepted" },
				adr: { status: "draft" },
			},
			planReview: "missing",
			...over,
		});

	it("A81 the document being written reads in progress while a process writes it", () => {
		const { planning } = planSteps(writingDraft({ live: { writing: true, planningStep: "plan-adr" } }));
		expect(states(planning).Decision).toBe("current");
	});

	it("A81 with no process running, the step the plan is at reads to do, not in progress", () => {
		const { planning } = planSteps(writingDraft({ live: {} }));
		expect(states(planning).Decision).toBe("not-yet");
		expect(Object.values(states(planning))).not.toContain("current");
	});

	it("A81 the impl being written reads in progress only while its planning step runs", () => {
		const running = planSteps(
			draft({ planReview: "missing", live: { writing: true, planningStep: "plan-impl" } }),
		);
		expect(states(running.planning).Impl).toBe("current");
		const idle = planSteps(draft({ planReview: "missing", live: {} }));
		expect(Object.values(states(idle.planning))).not.toContain("current");
	});
});
