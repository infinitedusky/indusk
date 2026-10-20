// clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan
// clause: a-late-answer-opens-a-follow-on/every-decision-stays
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { answerQuestionRecord } from "./answer.js";
import { openFollowOn } from "./follow-on.js";
import { readQuestions, recordQuestion } from "./history.js";
import type { Question } from "./record.js";

/**
 * decisions-as-questions T12: a late answer that differs from what was done opens
 * exactly one draft plan naming the question, the choice made and the one wanted. A
 * matching answer, an on-time answer or a second answer opens none more; the plan is
 * never accepted, approved or started.
 */
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpPlanning = () => {
	const d = mkdtempSync(join(tmpdir(), "follow-on-"));
	dirs.push(d);
	return d;
};
const wentAhead = (over: Partial<Question> = {}): Question => ({
	id: "q1",
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
const frontmatter = (dir: string, id: string) =>
	matter(readFileSync(join(dir, `seat-holds-${id}`, "brief.md"), "utf-8")).data;

describe("follow-on", () => {
	it("T12 — one draft per question, only on a late disagreement", () => {
		const dir = tmpPlanning();
		const q = wentAhead({ id: "q1" });
		expect(openFollowOn(dir, q, "b")).toMatchObject({ opened: true, plan: "seat-holds-q1" });
		expect(openFollowOn(dir, q, "c")).toMatchObject({ opened: false, updated: true });
		expect(openFollowOn(dir, wentAhead({ id: "q2" }), "a").opened).toBe(false);
		expect(openFollowOn(dir, wentAhead({ id: "q3", state: "waiting" }), "b").opened).toBe(false);
		expect(existsSync(join(dir, "seat-holds-q2"))).toBe(false);
		expect(existsSync(join(dir, "seat-holds-q3"))).toBe(false);
		const data = frontmatter(dir, "q1");
		expect(data).toMatchObject({ status: "draft", follow_on_of: "seat-holds/q1" });
		const body = readFileSync(join(dir, "seat-holds-q1", "brief.md"), "utf-8");
		expect(body).toContain("Which store?");
		expect(body).toContain("**Done:** a");
		expect(body).toContain("**The person wanted:** c");
	});

	it("never rewrites a follow-on a person has taken over", () => {
		const dir = tmpPlanning();
		const q = wentAhead();
		openFollowOn(dir, q, "b");
		const brief = join(dir, "seat-holds-q1", "brief.md");
		writeFileSync(brief, readFileSync(brief, "utf-8").replace("status: draft", "status: accepted"));
		expect(openFollowOn(dir, q, "c")).toMatchObject({ opened: false });
		expect(readFileSync(brief, "utf-8")).toContain("status: accepted");
		expect(readFileSync(brief, "utf-8")).toContain("**The person wanted:** b");
	});
});

describe("answerQuestionRecord — the answer applied to the record", () => {
	let f: Fixture;
	beforeEach(() => {
		f = makeFixture();
	});
	afterEach(() => f.cleanup());

	it("T12/T14 — a late, differing answer is kept, links its follow-on and commits the draft on main", () => {
		recordQuestion(f.main, wentAhead({ id: "q-1" }));
		const out = answerQuestionRecord(f.worktree, "seat-holds", "q-1", "b", 9);
		expect(out).toMatchObject({ state: "answered-late", answer: "b", followOn: "seat-holds-q-1" });
		expect(readQuestions(f.main, "seat-holds")[0]).toMatchObject({ followOn: "seat-holds-q-1" });
		const brief = join(f.main, ".indusk", "planning", "seat-holds-q-1", "brief.md");
		expect(existsSync(brief)).toBe(true);
		expect(f.git(f.main, "status", "--porcelain")).toBe("");
		expect(f.git(f.main, "log", "-3", "--format=%s")).toContain("follow-on to q-1 of seat-holds");
	});

	it("T12 — a late answer that matches, or an answer in time, opens nothing", () => {
		recordQuestion(f.main, wentAhead({ id: "q-1" }));
		recordQuestion(
			f.main,
			wentAhead({ id: "q-2", state: "waiting", dueAt: null, done: undefined }),
		);
		expect(answerQuestionRecord(f.main, "seat-holds", "q-1", "A", 9)).toMatchObject({
			state: "answered-late",
		});
		expect(answerQuestionRecord(f.main, "seat-holds", "q-2", "b", 9)).toMatchObject({
			state: "answered",
		});
		mkdirSync(join(f.main, ".indusk", "planning"), { recursive: true });
		expect(existsSync(join(f.main, ".indusk", "planning", "seat-holds-q-1"))).toBe(false);
		expect(existsSync(join(f.main, ".indusk", "planning", "seat-holds-q-2"))).toBe(false);
		expect(() => answerQuestionRecord(f.main, "seat-holds", "q-2", "again", 10)).toThrow(/already/);
		expect(() => answerQuestionRecord(f.main, "seat-holds", "q-9", "x", 10)).toThrow(/no question/);
	});
});
