// clause: the-cost-sets-the-wait/a-hold-frees-the-slot
// promise: sessions-are-capped
import { describe, expect, it } from "vitest";
import { planWaiting } from "../plans/waiting.js";
import { answersNote, applyAnswer, untold } from "../questions/answer.js";
import type { Question } from "../questions/record.js";
import { SessionBusy, SessionManager } from "./manager.js";
import { resumeFromQuestion, runningCount, waitOnQuestion } from "./question-wait.js";
import type { Session, SessionOptions } from "./start.js";

/**
 * decisions-as-questions T7, T8, T10. A question that holds ends its session and
 * the plan holds no place; one on a set time keeps both. The answer to a held
 * question is told to the agent when its run starts again.
 */
const held: Question = {
	id: "q-1",
	plan: "seat-holds",
	text: "Which store?",
	options: [
		{ label: "sqlite", changes: [] },
		{ label: "files", changes: [] },
	],
	recommended: "sqlite",
	reason: "simplest",
	statedCost: "cheap",
	cost: "cheap",
	askedAt: 1,
	dueAt: null,
	state: "waiting",
};

describe("held questions", () => {
	it("T7/T8 — a held question stops the session and frees its slot", () => {
		const s = { running: ["p1", "p2"], waiting: [] as string[] };
		const next = waitOnQuestion(s, "p1", { holds: true });
		expect(runningCount(next)).toBe(1);
		expect(next.waiting).toEqual(["p1"]);
		expect(runningCount(resumeFromQuestion(next, "p1"))).toBe(1);
		expect(resumeFromQuestion(next, "p1").waiting).toEqual([]);
	});

	it("T8 — a question on a set time keeps its slot", () => {
		const next = waitOnQuestion({ running: ["p1"], waiting: [] }, "p1", { holds: false });
		expect(runningCount(next)).toBe(1);
	});

	it("T8 — the manager lets a queued plan take the place a held question freed", () => {
		const start = (opts: SessionOptions): Session => ({
			pid: 1,
			kind: opts.kind,
			cwd: opts.cwd,
			say() {},
			answer() {},
			decide() {},
			async stop() {},
			done: new Promise(() => {}),
		});
		const m = new SessionManager({ recordPath: "/dev/null", start, max: 1 });
		const free = m.admitBuild("p", "seat-holds");
		expect(() => m.admitBuild("p", "other")).toThrow(SessionBusy);
		// the run ends on a held question: its place is let go and it is marked waiting
		free();
		m.holdQuestion("p", "seat-holds");
		expect(m.waitingOnQuestion("p", "seat-holds")).toBe(true);
		const other = m.admitBuild("p", "other");
		expect(typeof other).toBe("function");
		m.releaseQuestion("p", "seat-holds");
		expect(m.waitingOnQuestion("p", "seat-holds")).toBe(false);
	});

	it("T7 — the plan is listed under Needs you for the held question, with no timer", () => {
		const out = planWaiting({
			sessions: [],
			plans: [{ name: "seat-holds", documents: {}, workflow: null } as never],
			questions: [held],
		});
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			plan: "seat-holds",
			on: "question",
			decision: "Which store?",
			questionId: "q-1",
		});
		expect(out[0]).not.toHaveProperty("dueAt");
	});

	it("T10 — the answer is recorded and told to the agent when the run starts again", () => {
		const answered = applyAnswer(held, "files, we already run one", 9);
		expect(answered).toMatchObject({ state: "answered", answer: "files, we already run one" });
		expect(untold([answered])).toHaveLength(1);
		expect(answersNote(untold([answered]))).toContain("files, we already run one");
		expect(answersNote(untold([answered]))).toContain("q-1");
		expect(untold([{ ...answered, told: true }])).toHaveLength(0);
		expect(answersNote([])).toBe("");
	});

	it("T1 — an empty reply is not an answer", () => {
		expect(() => applyAnswer(held, "   ", 9)).toThrow(/empty reply/);
	});
});
