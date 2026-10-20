// clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan
// clause: the-cost-sets-the-wait/the-setting-decides
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { answerQuestionRecord, answersNote, untold } from "./answer.js";
import { readQuestions, recordQuestion } from "./history.js";
import type { Question } from "./record.js";

const wentAhead = (over: Partial<Question> = {}): Question => ({
	id: "q-1",
	plan: "seat-holds",
	text: "Which store?",
	options: [
		{ label: "a", changes: [] },
		{ label: "b", changes: [] },
	],
	recommended: "a",
	reason: "simplest",
	statedCost: "cheap",
	cost: "cheap",
	askedAt: 1,
	dueAt: 2,
	state: "went-ahead",
	done: "a",
	wentAheadAt: 3,
	...over,
});

describe("a second late answer", () => {
	let f: Fixture;
	beforeEach(() => {
		f = makeFixture();
	});
	afterEach(() => f.cleanup());

	it("T38 — is recorded and rewrites the open follow-on, opening no second plan", () => {
		recordQuestion(f.main, wentAhead());
		answerQuestionRecord(f.worktree, "seat-holds", "q-1", "b", 9);
		const second = answerQuestionRecord(f.worktree, "seat-holds", "q-1", "c", 10);
		expect(second).toMatchObject({
			state: "answered-late",
			answer: "c",
			followOn: "seat-holds-q-1",
		});
		expect(readQuestions(f.main, "seat-holds")[0]).toMatchObject({ answer: "c" });
		const planning = join(f.main, ".indusk", "planning");
		expect(readdirSync(planning).filter((n) => n.startsWith("seat-holds-"))).toEqual([
			"seat-holds-q-1",
		]);
		expect(readFileSync(join(planning, "seat-holds-q-1", "brief.md"), "utf-8")).toContain(
			"**The person wanted:** c",
		);
	});

	it("an answer given in time is still final", () => {
		recordQuestion(f.main, wentAhead({ state: "waiting", dueAt: null, done: undefined }));
		answerQuestionRecord(f.main, "seat-holds", "q-1", "b", 9);
		expect(() => answerQuestionRecord(f.main, "seat-holds", "q-1", "c", 10)).toThrow(/already/);
	});
});

describe("what the next step is told", () => {
	it("T30 — a go-ahead no session heard is told on the next step, a heard one is not", () => {
		const unheard = wentAhead({ id: "q-1", told: false });
		const heard = wentAhead({ id: "q-2", told: true });
		const old = wentAhead({ id: "q-3" });
		expect(untold([unheard, heard, old]).map((q) => q.id)).toEqual(["q-1"]);
		expect(answersNote([unheard])).toContain("went ahead with your recommendation: a");
	});
});
