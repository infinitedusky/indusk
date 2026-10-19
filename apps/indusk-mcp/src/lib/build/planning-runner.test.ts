// clause: an-accepted-brief-is-planned-unasked/decides-and-records
import { describe, expect, it } from "vitest";
import type { PlanningDocument, PlanningState } from "./next-planning-step.js";
import { runPlanning } from "./planning-runner.js";
import type { PlanningStep } from "./step-env.js";

/**
 * promise: an-accepted-brief-is-planned-unasked — a-brief-is-planned-unasked A7.
 *
 * The planning run asks `nextPlanningStep` after every step and runs a fresh
 * session for each. It ends when the impl passes its check, waiting for the
 * person's approval; a blocker or two steps without progress end it with that
 * reason. The plan and the sessions are scripted fakes.
 */

const absent: PlanningDocument = { exists: false, ok: false };
const good: PlanningDocument = { exists: true, ok: true };

const at = (
	tp: PlanningDocument,
	adr: PlanningDocument,
	impl: PlanningDocument,
	over: Partial<PlanningState> = {},
): PlanningState => ({
	required: ["research", "brief", "test-plan", "adr", "impl", "retrospective"],
	documents: { "test-plan": tp, adr, impl },
	implStatus: impl.exists ? "draft" : null,
	contractOk: true,
	unapprovedLooks: [],
	blocker: null,
	review: { exists: false, complete: false, dismissals: [], amendments: [] },
	...over,
});

const reviewed: Partial<PlanningState> = {
	review: { exists: true, complete: true, dismissals: [], amendments: [] },
};

function scripted(states: PlanningState[], opts: { stuck?: boolean } = {}) {
	let i = 0;
	const ran: PlanningStep[] = [];
	return {
		ran,
		deps: {
			read: async () => states[Math.min(i, states.length - 1)],
			run: async (step: PlanningStep) => {
				ran.push(step);
				if (!opts.stuck) i += 1;
				return { error: null };
			},
		},
	};
}

describe("A7 — a planning run ends at approval, a blocker, or no progress", () => {
	it("writes the test plan, the ADR and the impl, has the plan read, then stops waiting for approval", async () => {
		const s = scripted([
			at(absent, absent, absent),
			at(good, absent, absent),
			at(good, good, absent),
			at(good, good, good),
			at(good, good, good, reviewed),
		]);
		expect(await runPlanning(s.deps)).toEqual({ step: "ready-for-approval" });
		// Moved by audit-concerns-are-answered A21: the plan review is the run's last step.
		expect(s.ran).toEqual(["plan-test-plan", "plan-adr", "plan-impl", "plan-review"]);
	});

	it("ends with the blocker's reason when a step writes one", async () => {
		const s = scripted([
			at(absent, absent, absent),
			at(good, absent, absent, { blocker: "which store holds the holds" }),
		]);
		const stop = await runPlanning(s.deps);
		expect(stop.step).toBe("cannot-continue");
		expect(JSON.stringify(stop)).toContain("which store holds the holds");
		expect(s.ran).toEqual(["plan-test-plan"]);
	});

	it("ends when two steps in a row change nothing", async () => {
		const s = scripted([at(absent, absent, absent)], { stuck: true });
		expect(await runPlanning(s.deps)).toEqual({
			step: "cannot-continue",
			why: "two steps in a row made no progress",
		});
		expect(s.ran).toEqual(["plan-test-plan", "plan-test-plan"]);
	});

	it("ends, naming the error, when a step's session fails", async () => {
		const states = [at(absent, absent, absent)];
		const stop = await runPlanning({
			read: async () => states[0],
			run: async () => ({ error: "claude exited 1" }),
		});
		expect(stop.step).toBe("cannot-continue");
		expect(JSON.stringify(stop)).toContain("claude exited 1");
	});

	it("starts nothing while a look is not approved", async () => {
		const s = scripted([at(absent, absent, absent, { unapprovedLooks: ["seat-card"] })]);
		expect(await runPlanning(s.deps)).toEqual({ step: "wait-for-looks", looks: ["seat-card"] });
		expect(s.ran).toEqual([]);
	});
});
