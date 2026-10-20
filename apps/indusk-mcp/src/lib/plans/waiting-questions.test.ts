// promise: decisions-wait-in-one-place
// promise: sessions-are-capped
// clause: the-cost-sets-the-wait/a-hold-frees-the-slot
// clause: a-decision-is-a-question/asked-with-a-recommendation
import { describe, expect, it } from "vitest";
import { derivePlanPosition } from "../lifecycle.js";
import type { Question } from "../questions/record.js";
import type { PlanSnapshot } from "./steps.js";
import { planWaiting, type WaitingSession } from "./waiting.js";

const plan: PlanSnapshot & { name: string } = {
	name: "seat-holds",
	workflow: "feature",
	position: derivePlanPosition({
		summary: {
			name: "seat-holds",
			stage: "impl",
			stageStatus: "in-progress",
			nextStep: "",
			dependencies: [],
			documents: ["research", "brief", "test-plan", "adr", "impl"].map((d) => `${d}.md`),
			workflow: "feature",
		},
		impl: null,
		readiness: { missing: [], nonTerminalRows: [], unprovenPromises: [] } as never,
		archived: false,
	}),
	documents: { impl: { status: "in-progress" } },
};

const q = (over: Partial<Question> = {}): Question => ({
	id: "q-1",
	plan: "seat-holds",
	text: "Which store?",
	options: [
		{ label: "Postgres", changes: [] },
		{ label: "SQLite", changes: [] },
	],
	recommended: "SQLite",
	reason: "simplest",
	statedCost: "cheap",
	cost: "cheap",
	askedAt: 0,
	dueAt: null,
	state: "waiting",
	...over,
});

const waitingFor = (questions: Question[], sessions: WaitingSession[] = []) =>
	planWaiting({ sessions, plans: [plan], questions }).find((w) => w.plan === "seat-holds");

describe("T31 — a question on a set time whose session ended", () => {
	it("is listed under Needs you with its time left", () => {
		const w = waitingFor([q({ dueAt: 5_000 })]);
		expect(w).toMatchObject({ on: "question", questionId: "q-1", dueAt: 5_000 });
	});

	it("is not listed while a session still holds it", () => {
		const w = waitingFor([q({ dueAt: 5_000, session: { id: "s", requestId: "r" } })]);
		expect(w).toBeUndefined();
	});
});

describe("T32 — an answered question whose run did not restart", () => {
	const answered = q({ state: "answered", answer: "Postgres", dueAt: null });

	it("keeps the plan under Needs you, worded as waiting to restart", () => {
		const w = waitingFor([answered]);
		expect(w).toMatchObject({ on: "question", restart: true, questionId: "q-1" });
		expect(w?.decision).toContain("did not restart");
	});

	it("lists nothing once a run is going, or once the answer was told", () => {
		const running: WaitingSession = { plan: "seat-holds", kind: "build", question: null };
		expect(waitingFor([answered], [running])).toBeUndefined();
		expect(waitingFor([{ ...answered, told: true }])).toBeUndefined();
	});
});

describe("T33 — the recommended option is offered first", () => {
	it("a held question offers its recommendation as accept", () => {
		expect(waitingFor([q()])).toMatchObject({ accept: "SQLite", alternative: "Postgres" });
	});

	it("a pending request of a recorded question offers it too, and says it is recorded", () => {
		const asked: WaitingSession = {
			plan: "seat-holds",
			kind: "build",
			question: {
				requestId: "r1",
				questions: [
					{
						question: "Which store?",
						options: [{ label: "Postgres" }, { label: "SQLite" }],
					},
				],
			},
		};
		const w = waitingFor([q({ dueAt: 9, session: { id: "s", requestId: "r1" } })], [asked]);
		expect(w).toMatchObject({
			accept: "SQLite",
			alternative: "Postgres",
			recordedQuestion: "q-1",
			requestId: "r1",
		});
	});

	it("a request that is not a recorded question keeps the order it was asked in", () => {
		const asked: WaitingSession = {
			plan: "seat-holds",
			kind: "planning",
			question: {
				requestId: "r9",
				questions: [{ question: "?", options: [{ label: "A" }, { label: "B" }] }],
			},
		};
		expect(waitingFor([], [asked])).toMatchObject({ accept: "A", alternative: "B" });
	});
});
