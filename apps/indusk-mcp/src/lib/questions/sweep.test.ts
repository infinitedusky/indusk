// clause: the-cost-sets-the-wait/the-setting-decides
// clause: the-cost-sets-the-wait/holds-by-default
// clause: what-was-agreed-is-never-cheap/never-timed-out
import { describe, expect, it } from "vitest";
import { readQuestionWait } from "./deadline.js";
import type { Change, Question } from "./record.js";
import { sweep } from "./sweep.js";

const opt = (label: string, changes: Change[] = []) => ({ label, changes });
const waiting = (over: Partial<Question> = {}): Question => ({
	id: "q",
	plan: "p",
	text: "t",
	options: [opt("a"), opt("b")],
	recommended: "a",
	reason: "r",
	statedCost: "cheap",
	cost: "cheap",
	askedAt: 0,
	state: "waiting",
	...over,
});

describe("sweep", () => {
	it("T23 — goes ahead only as each cost's setting says", () => {
		const sent: string[] = [];
		const now = Date.parse("2026-10-19T12:00:00Z");
		const wait = readQuestionWait({ cheap: 5, expensive: "immediate" });
		const qs = [
			waiting({ id: "c", cost: "cheap", askedAt: now - 6 * 60_000 }),
			waiting({ id: "e", cost: "expensive", askedAt: now }),
			waiting({ id: "m", cost: "moderate", askedAt: 0 }),
			waiting({ id: "r", cost: "cheap", askedAt: 0, options: [opt("a", ["look"]), opt("b")] }),
		];
		const out = sweep(qs, now, wait, (q, choice) => sent.push(`${q.id}:${choice}`));
		expect(sent).toEqual(["c:a", "e:a"]);
		const c = out.find((q) => q.id === "c");
		expect(c).toMatchObject({ state: "went-ahead", done: "a", wentAheadAt: now });
		expect(out.filter((q) => q.state === "waiting").map((q) => q.id)).toEqual(["m", "r"]);
	});

	it("leaves an answered question alone, and a gone session does not stop the record", () => {
		const wait = readQuestionWait({ cheap: "immediate" });
		const answered = waiting({ id: "x", state: "answered", answer: "b" });
		const out = sweep([answered, waiting({ id: "y" })], 10, wait, () => {
			throw new Error("session gone");
		});
		expect(out[0]).toBe(answered);
		expect(out[1]).toMatchObject({ state: "went-ahead", done: "a" });
	});

	it("T5 — a stored time is read after the admin was down, and goes ahead on that read", () => {
		const wait = readQuestionWait({});
		const q = waiting({ dueAt: 1_000 });
		expect(sweep([q], 5_000_000, wait, () => {})[0]?.state).toBe("went-ahead");
		expect(sweep([q], 999, wait, () => {})[0]?.state).toBe("waiting");
	});
});

describe("sweep — what the session said", () => {
	const wait = readQuestionWait({ cheap: "immediate" });

	it("T30 — a request already answered leaves the question untouched", () => {
		const q = waiting({ id: "x" });
		const out = sweep([q], 10, wait, () => {
			throw new Error("request r1 was already answered");
		});
		expect(out[0]).toBe(q);
	});

	it("T30 — a session that is gone is a go-ahead not yet told; one that heard it is told", () => {
		const gone = sweep([waiting()], 10, wait, () => {
			throw new Error("no session s1 is running");
		});
		expect(gone[0]).toMatchObject({ state: "went-ahead", told: false });
		const heard = sweep([waiting()], 10, wait, () => {});
		expect(heard[0]).toMatchObject({ state: "went-ahead", told: true });
	});
});

describe("sweepHistory", () => {
	it("sends a due question on, keeps it as went-ahead in the history, and leaves the held ones", async () => {
		const { makeFixture } = await import("../bookkeeping/fixture.test-support.js");
		const { readQuestions, recordQuestion } = await import("./history.js");
		const { sweepHistory } = await import("./sweep.js");
		const f = makeFixture();
		try {
			recordQuestion(f.main, waiting({ id: "q-1", plan: "seat-holds", dueAt: 100 }));
			recordQuestion(f.main, waiting({ id: "q-2", plan: "seat-holds", dueAt: null }));
			const sent: string[] = [];
			const out = sweepHistory(
				f.worktree,
				"seat-holds",
				200,
				() => readQuestionWait({}),
				(q, choice) => sent.push(`${q.id}:${choice}`),
			);
			expect(sent).toEqual(["q-1:a"]);
			expect(out.map((q) => q.state)).toEqual(["went-ahead", "waiting"]);
			expect(readQuestions(f.main, "seat-holds").map((q) => q.state)).toEqual([
				"went-ahead",
				"waiting",
			]);
			// a setting it refuses holds everything: nothing more goes ahead
			recordQuestion(f.main, waiting({ id: "q-3", plan: "seat-holds", dueAt: undefined }));
			sweepHistory(
				f.main,
				"seat-holds",
				10 ** 12,
				() => readQuestionWait({ cheap: "soon" }),
				(q) => sent.push(q.id),
			);
			expect(sent).toEqual(["q-1:a"]);
		} finally {
			f.cleanup();
		}
	});
});
