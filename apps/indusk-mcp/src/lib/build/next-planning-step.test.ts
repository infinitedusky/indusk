// promise: a-plan-is-read-cold-before-approval
// clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance
// clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check
import { describe, expect, it } from "vitest";
import {
	nextPlanningStep,
	type PlanningDocument,
	type PlanningState,
} from "./next-planning-step.js";

/**
 * promise: an-accepted-brief-is-planned-unasked — a-brief-is-planned-unasked A3, A4.
 *
 * The planning run's next step is a pure decision over what was read: which
 * documents the workflow needs, which exist and pass their check, whether the
 * impl is approved, whether every look is approved. A3 pins when nothing is
 * started; A4 pins which document comes next and that a document failing its
 * check is the same step again.
 */

const FULL = ["research", "brief", "test-plan", "adr", "impl", "retrospective"] as const;
const NO_ADR = ["brief", "test-plan", "impl", "retrospective"] as const;
const absent: PlanningDocument = { exists: false, ok: false };
const good: PlanningDocument = { exists: true, ok: true };
const failing: PlanningDocument = { exists: true, ok: false };

function state(over: Partial<PlanningState> = {}): PlanningState {
	return {
		required: FULL,
		documents: { "test-plan": absent, adr: absent, impl: absent },
		implStatus: null,
		contractOk: true,
		unapprovedLooks: [],
		blocker: null,
		review: { exists: true, complete: true, dismissals: [], amendments: [] },
		...over,
	};
}

describe("A3 — a plan that is written or approved starts no planning run", () => {
	it("is ready for approval when the test plan, ADR and impl exist and pass", () => {
		const s = state({
			documents: { "test-plan": good, adr: good, impl: good },
			implStatus: "draft",
		});
		expect(nextPlanningStep(s)).toEqual({ step: "ready-for-approval" });
	});

	it("starts nothing when the impl is approved, and says so", () => {
		const s = state({
			documents: { "test-plan": good, adr: good, impl: good },
			implStatus: "approved",
		});
		const next = nextPlanningStep(s);
		expect(next.step).toBe("cannot-continue");
		expect(JSON.stringify(next)).toContain("approved");
	});

	it("is not ready while the contract check refuses, and writes the impl again", () => {
		const s = state({
			documents: { "test-plan": good, adr: good, impl: good },
			implStatus: "draft",
			contractOk: false,
		});
		expect(nextPlanningStep(s)).toEqual({ step: "plan-impl" });
	});
});

describe("A4 — the next step is the first missing document the workflow needs", () => {
	it("starts with the test plan", () => {
		expect(nextPlanningStep(state())).toEqual({ step: "plan-test-plan" });
	});

	it("then the ADR once the test plan passes", () => {
		const s = state({ documents: { "test-plan": good, adr: absent, impl: absent } });
		expect(nextPlanningStep(s)).toEqual({ step: "plan-adr" });
	});

	it("then the impl", () => {
		const s = state({ documents: { "test-plan": good, adr: good, impl: absent } });
		expect(nextPlanningStep(s)).toEqual({ step: "plan-impl" });
	});

	it("skips the ADR when the workflow has none", () => {
		const s = state({
			required: NO_ADR,
			documents: { "test-plan": good, adr: absent, impl: absent },
		});
		expect(nextPlanningStep(s)).toEqual({ step: "plan-impl" });
	});

	it("a document that fails its check is the same step again", () => {
		const s = state({ documents: { "test-plan": good, adr: failing, impl: absent } });
		expect(nextPlanningStep(s)).toEqual({ step: "plan-adr" });
		const t = state({ documents: { "test-plan": failing, adr: absent, impl: absent } });
		expect(nextPlanningStep(t)).toEqual({ step: "plan-test-plan" });
	});

	it("waits while a look is not approved, naming it, and writes nothing", () => {
		const s = state({ unapprovedLooks: ["seat-card"] });
		expect(nextPlanningStep(s)).toEqual({ step: "wait-for-looks", looks: ["seat-card"] });
	});

	it("stops, naming it, on a blocker", () => {
		const next = nextPlanningStep(state({ blocker: "which store holds the holds" }));
		expect(next.step).toBe("cannot-continue");
		expect(JSON.stringify(next)).toContain("which store holds the holds");
	});

	it("stops on a failed session, and on two steps without progress", () => {
		const failed = nextPlanningStep(state(), { last: { progressed: false, error: "exit 1" } });
		expect(failed.step).toBe("cannot-continue");
		const stuck = { progressed: false, error: null };
		const twice = nextPlanningStep(state(), { last: stuck, previous: stuck });
		expect(twice).toEqual({
			step: "cannot-continue",
			why: "two steps in a row made no progress",
		});
		const once = nextPlanningStep(state(), {
			last: stuck,
			previous: { progressed: true, error: null },
		});
		expect(once).toEqual({ step: "plan-test-plan" });
	});
});

// clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold
// clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval
describe("A21, A20 — the plan review is the planning run's last step", () => {
	const written = {
		documents: { "test-plan": good, adr: good, impl: good },
		implStatus: "draft",
	};
	it("is next once the impl and the contract pass and there is no review", () => {
		const s = state({
			...written,
			review: { exists: false, complete: false, dismissals: [], amendments: [] },
		});
		expect(nextPlanningStep(s)).toEqual({ step: "plan-review" });
	});
	it("stays next while the review is incomplete or unanswered", () => {
		const s = state({
			...written,
			review: { exists: true, complete: false, dismissals: [], amendments: [] },
		});
		expect(nextPlanningStep(s)).toEqual({ step: "plan-review" });
	});
	it("is ready for approval once answered", () => {
		expect(nextPlanningStep(state(written))).toMatchObject({ step: "ready-for-approval" });
	});
	it("carries each dismissal, with its finding and reason, into the stop", () => {
		const dismissal = { question: "q", finding: "a.ts:3 — x", reason: "too unlikely" };
		const s = state({
			...written,
			review: { exists: true, complete: true, dismissals: [dismissal], amendments: [] },
		});
		expect(nextPlanningStep(s)).toMatchObject({
			step: "ready-for-approval",
			dismissals: [dismissal],
		});
	});
});

// clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold — A37
// clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval — A42
describe("Build Phase 8 — a stale review is read again, and a changed brief is shown", () => {
	const ready = (over: Partial<PlanningState["review"]> = {}) =>
		state({
			documents: { "test-plan": good, adr: good, impl: good },
			implStatus: "draft",
			review: { exists: true, complete: true, dismissals: [], amendments: [], ...over },
		});

	it("A37 — a complete plan review written before the documents last changed is read cold again", () => {
		expect(nextPlanningStep(ready({ stale: true }))).toEqual({ step: "plan-review" });
		expect(nextPlanningStep(ready({ stale: false })).step).toBe("ready-for-approval");
	});

	it("A42 — a brief changed since it was accepted is listed at the ready-for-approval stop", () => {
		const changed = [{ part: "promise", name: "a-x", was: "old", now: "new" }] as const;
		const stop = nextPlanningStep(ready({ briefChanges: changed }));
		expect(stop).toMatchObject({ step: "ready-for-approval", briefChanges: changed });
		expect(nextPlanningStep(ready())).not.toHaveProperty("briefChanges");
	});
});
