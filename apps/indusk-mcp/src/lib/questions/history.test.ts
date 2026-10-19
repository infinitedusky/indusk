// clause: a-late-answer-opens-a-follow-on/every-decision-stays
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { readHistory } from "../plans/history.js";
import { nextQuestionId, readQuestions, recordQuestion } from "./history.js";
import type { Question } from "./record.js";

/**
 * decisions-as-questions T14, the history half: a question is kept in the plan's
 * history in each of its four states, the latest line for an id is its state, and
 * an answer given in time is also a decision line as any answered decision is.
 */
let f: Fixture;
beforeEach(() => {
	f = makeFixture();
});
afterEach(() => f.cleanup());

const base: Question = {
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

describe("T14 — every question stays, in every state", () => {
	it("the latest recorded state of each id is read back, with its record", () => {
		recordQuestion(f.main, base);
		recordQuestion(f.main, { ...base, id: "q-2", text: "Which port?" });
		recordQuestion(f.main, { ...base, state: "went-ahead", done: "sqlite", wentAheadAt: 5 });
		recordQuestion(f.main, {
			...base,
			state: "answered-late",
			done: "sqlite",
			answer: "files",
			answeredAt: 9,
			followOn: "seat-holds-q-1",
		});
		const qs = readQuestions(f.worktree, "seat-holds");
		expect(qs.map((q) => [q.id, q.state])).toEqual([
			["q-1", "answered-late"],
			["q-2", "waiting"],
		]);
		expect(qs[0]).toMatchObject({ answer: "files", done: "sqlite", followOn: "seat-holds-q-1" });
		expect(nextQuestionId(f.main, "seat-holds")).toBe("q-3");
	});

	it("an answer in time is also a decision line; other states are not", () => {
		recordQuestion(f.main, base);
		expect(readHistory(f.main, "seat-holds")).toEqual([]);
		recordQuestion(f.main, { ...base, state: "answered", answer: "files" });
		expect(readHistory(f.main, "seat-holds")).toMatchObject([
			{ decision: "q-1: Which store?", answer: "files", by: "person" },
		]);
	});
});
