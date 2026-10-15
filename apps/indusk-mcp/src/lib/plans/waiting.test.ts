import { describe, expect, it } from "vitest";
import { derivePlanPosition, type PlanPositionState } from "../lifecycle.js";
import type { PlanSummary } from "../plan-parser.js";
import type { PlanSnapshot } from "./steps.js";
import { planWaiting, type WaitingSession } from "./waiting.js";

// promise: decisions-wait-in-one-place

/**
 * plan-cockpit A13, the package's half: a plan whose agent asked a question,
 * a plan waiting for approval and a plan stopped for review each wait on the
 * person, naming the step they wait at; a plan waiting on nothing does not.
 * Positions come from the real `derivePlanPosition`, as `steps.test.ts` does.
 */

function positionOf(stage: PlanSummary["stage"], stageStatus: string): PlanPositionState {
	return derivePlanPosition({
		summary: {
			name: "p",
			stage,
			stageStatus,
			nextStep: "",
			dependencies: [],
			documents: ["research", "brief", "test-plan", "adr", "impl"].map((d) => `${d}.md`),
			workflow: "feature",
		},
		impl: null,
		readiness: { missing: [], nonTerminalRows: [], unprovenPromises: [] } as never,
		archived: false,
	});
}

type Plan = PlanSnapshot & { name: string };

const accepted = { status: "accepted" };

const asking: Plan = {
	name: "asking",
	workflow: "feature",
	position: positionOf("brief", "draft"),
	documents: { research: { status: "complete" }, brief: { status: "draft" } },
};

const approval: Plan = {
	name: "awaiting-approval",
	workflow: "feature",
	position: positionOf("impl", "draft"),
	documents: {
		research: { status: "complete" },
		brief: accepted,
		"test-plan": accepted,
		adr: accepted,
		impl: { status: "draft" },
	},
};

const review: Plan = {
	name: "at-review",
	workflow: "feature",
	position: positionOf("impl", "in-progress"),
	documents: {
		research: { status: "complete" },
		brief: accepted,
		"test-plan": accepted,
		adr: accepted,
		impl: { status: "in-progress" },
	},
};

const building: Plan = { ...review, name: "mid-build" };

const question: WaitingSession = {
	plan: "asking",
	kind: "planning",
	question: {
		requestId: "req-1",
		questions: [
			{
				question: "Which seat map should holds use?",
				options: [{ label: "The venue's map" }, { label: "Our own grid" }],
			},
		],
	},
};

const plans = [asking, approval, review, building];
const builds = [
	{ plan: "at-review", stoppedAt: "review" },
	{ plan: "mid-build", stoppedAt: null },
];

describe("A13 — what a plan waits on, and the step it waits at", () => {
	it("A13 a session with a pending question waits on the question, at the plan's current step", () => {
		const w = planWaiting({ sessions: [question], plans, builds }).find((x) => x.plan === "asking");
		expect(w).toMatchObject({
			on: "question",
			step: "Brief",
			decision: "Which seat map should holds use?",
			accept: "The venue's map",
			alternative: "Our own grid",
			requestId: "req-1",
		});
	});

	it("A13 an impl draft whose other documents are accepted waits on approval, at Impl", () => {
		const w = planWaiting({ sessions: [], plans, builds }).find(
			(x) => x.plan === "awaiting-approval",
		);
		expect(w).toMatchObject({ on: "approval", step: "Impl", accept: "Approve" });
		expect(w?.decision).toBeTruthy();
		expect(w?.alternative).toBeTruthy();
	});

	it("A13 a build stopped at review waits on review, at Review", () => {
		const w = planWaiting({ sessions: [], plans, builds }).find((x) => x.plan === "at-review");
		expect(w).toMatchObject({ on: "review", step: "Review", accept: "Accept" });
	});

	it("A13 a plan whose position is review waits on review after the admin restarts (no build held)", () => {
		const atReview: Plan = {
			...review,
			position: { ...review.position, position: "review" } as PlanPositionState,
		};
		const w = planWaiting({ sessions: [], plans: [atReview], builds: [] });
		expect(w).toEqual([expect.objectContaining({ plan: "at-review", on: "review" })]);
	});

	it("A13 a plan waiting on nothing is absent, and each plan appears at most once", () => {
		const all = planWaiting({ sessions: [question], plans, builds });
		expect(all.map((w) => w.plan)).toEqual(["asking", "awaiting-approval", "at-review"]);
		expect(all.find((w) => w.plan === "mid-build")).toBeUndefined();
	});

	it("A13 a session with no question pending does not make its plan wait", () => {
		const quiet = { ...question, question: null };
		expect(
			planWaiting({ sessions: [quiet], plans: [asking], builds: [] }).map((w) => w.plan),
		).toEqual([]);
	});

	it("A13 a question outranks the plan's own approval: one decision per plan", () => {
		const both = planWaiting({
			sessions: [{ ...question, plan: "awaiting-approval" }],
			plans: [approval],
			builds: [],
		});
		expect(both).toHaveLength(1);
		expect(both[0]?.on).toBe("question");
	});
});

describe("cockpit-audit-fixes A8 — approval waits for a finished plan", () => {
	// promise: approval-waits-for-a-finished-plan
	it("A8 a draft impl a session is still writing is not under approval; once the session ends, it is", () => {
		const writing: WaitingSession = { plan: "awaiting-approval", kind: "planning", question: null };
		expect(planWaiting({ sessions: [writing], plans: [approval], builds: [] })).toEqual([]);
		const after = planWaiting({ sessions: [], plans: [approval], builds: [] });
		expect(after).toEqual([expect.objectContaining({ plan: "awaiting-approval", on: "approval" })]);
	});
});

describe("cockpit-audit-fixes A12 — an idle author does not hide approval", () => {
	// promise: approval-waits-for-a-finished-plan
	it("A12 a live session that finished its turn and asked nothing leaves the draft impl under approval; while its turn is open it does not", () => {
		const idle: WaitingSession = {
			plan: "awaiting-approval",
			kind: "planning",
			question: null,
			writing: false,
		};
		const open: WaitingSession = { ...idle, writing: true };
		expect(planWaiting({ sessions: [open], plans: [approval], builds: [] })).toEqual([]);
		expect(planWaiting({ sessions: [idle], plans: [approval], builds: [] })).toEqual([
			expect.objectContaining({ plan: "awaiting-approval", on: "approval" }),
		]);
	});
});

/**
 * plan-stories A14: a plan waiting only on an amendment waits on the person, at its
 * Brief step; one with no amendment and nothing else waiting does not. The new
 * input is passed through a cast, so the file compiles before the input exists.
 *
 * promise: decisions-wait-in-one-place
 */
describe("A14 — an amendment waits on the person, at the Brief", () => {
	const withAmendments = (
		amendments: { plan: string; count: number }[],
		list: Plan[],
		extra = {},
	) =>
		planWaiting({ sessions: [], plans: list, builds: [], amendments, ...extra } as Parameters<
			typeof planWaiting
		>[0]);

	it("A14 an approved plan with an amendment and nothing else waiting is reported on the amendment", () => {
		const w = withAmendments([{ plan: "mid-build", count: 1 }], [building]).find(
			(x) => x.plan === "mid-build",
		);
		expect(w).toMatchObject({ plan: "mid-build", on: "amendment", step: "Brief" });
	});

	it("A14 the same plan with no amendment is not reported", () => {
		expect(withAmendments([], [building]).map((w) => w.plan)).toEqual([]);
	});

	it("A14 a question still outranks the amendment", () => {
		const w = planWaiting({
			sessions: [{ ...question, plan: "mid-build" }],
			plans: [building],
			builds: [],
			amendments: [{ plan: "mid-build", count: 1 }],
		} as Parameters<typeof planWaiting>[0]);
		expect(w).toHaveLength(1);
		expect(w[0]?.on).toBe("question");
	});
});
