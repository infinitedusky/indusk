import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { appendDecision, historyPath, readHistory } from "./history.js";

// promise: decisions-wait-in-one-place

/**
 * plan-cockpit A17: every answer to a plan's decision is a dated line in
 * `.indusk/plan-history/<plan>.md` in the main checkout, committed on `main`
 * through the notes writer — only that file, never anyone's staged work — so
 * a fresh read, after the admin that wrote it is gone, still shows it. When
 * `main` cannot take the commit, the line stays written and the reason says why.
 */

let f: Fixture;
beforeEach(() => {
	f = makeFixture();
});
afterEach(() => f.cleanup());

const entry = (answer: string, at = "2026-10-10T10:00:00.000Z") => ({
	decision: "The plan is written. Approve it?",
	answer,
	by: "person",
	at,
});
const lastSubject = () => f.git(f.main, "log", "-1", "--format=%s", "main");

describe("A17 — a plan's decisions outlast the admin", () => {
	it("A17 an answer appended from the plan's worktree is read back fresh, from the main checkout's history file", () => {
		const r = appendDecision(f.worktree, "seat-holds", entry("Approve"));
		expect(r.commit).toEqual({ committed: true });
		const file = join(f.main, ".indusk", "plan-history", "seat-holds.md");
		expect(historyPath(f.worktree, "seat-holds")).toBe(file);
		expect(existsSync(file)).toBe(true);
		expect(existsSync(join(f.worktree, ".indusk", "plan-history"))).toBe(false);
		// A fresh read — nothing held in memory — from either checkout.
		expect(readHistory(f.main, "seat-holds")).toEqual([entry("Approve")]);
		expect(readHistory(f.worktree, "seat-holds")).toEqual([entry("Approve")]);
	});

	it("A17 each answer is committed on main as `chore(indusk): <plan> — <answer>`, and the file reads as dated lines", () => {
		appendDecision(f.main, "seat-holds", entry("Approve"));
		expect(lastSubject()).toBe("chore(indusk): seat-holds — Approve");
		appendDecision(
			f.main,
			"seat-holds",
			entry("Not yet — the hold time is wrong", "2026-10-11T09:30:00.000Z"),
		);
		expect(lastSubject()).toBe("chore(indusk): seat-holds — Not yet — the hold time is wrong");
		expect(f.git(f.main, "status", "--porcelain")).toBe("");
		const text = readFileSync(historyPath(f.main, "seat-holds"), "utf-8");
		expect(text).toContain("2026-10-10T10:00:00.000Z");
		expect(text).toContain("2026-10-11T09:30:00.000Z");
		expect(readHistory(f.main, "seat-holds").map((e) => e.answer)).toEqual([
			"Approve",
			"Not yet — the hold time is wrong",
		]);
	});

	it("A17 a person's staged work stays staged and out of the decision's commit", () => {
		writeFileSync(join(f.main, "mine.txt"), "mine\n");
		f.git(f.main, "add", "mine.txt");
		expect(appendDecision(f.main, "seat-holds", entry("Approve")).commit.committed).toBe(true);
		expect(f.git(f.main, "show", "--name-only", "--format=", "HEAD")).toBe(
			".indusk/plan-history/seat-holds.md",
		);
		expect(f.git(f.main, "diff", "--cached", "--name-only")).toBe("mine.txt");
	});

	it("A17 when main is not on its trunk branch the line is written, left uncommitted, and the reason says why", () => {
		f.git(f.main, "checkout", "-q", "-b", "elsewhere");
		const r = appendDecision(f.main, "seat-holds", entry("Approve"));
		expect(r.commit.committed).toBe(false);
		expect(!r.commit.committed && r.commit.reason).toMatch(/elsewhere/);
		expect(readHistory(f.main, "seat-holds")).toEqual([entry("Approve")]);
		expect(f.git(f.main, "log", "-1", "--format=%s", "elsewhere")).toBe("init");
	});

	it("A17 a plan name that is not one kebab-case segment is refused before anything is written", () => {
		const before = f.git(f.main, "rev-parse", "HEAD");
		for (const bad of ["../escape", "a/b", "Not Kebab", ""]) {
			expect(() => appendDecision(f.main, bad, entry("Approve"))).toThrow();
		}
		mkdirSync(join(f.main, ".indusk"), { recursive: true });
		expect(existsSync(join(f.main, ".indusk", "escape.md"))).toBe(false);
		expect(f.git(f.main, "rev-parse", "HEAD")).toBe(before);
	});

	it("A17 a plan with no history reads as none", () => {
		expect(readHistory(f.main, "never-decided")).toEqual([]);
	});
});

describe("cockpit-audit-fixes A11 — main cannot take the history commit", () => {
	// promise: indusk-leaves-main-clean
	it("A11 the line is written, left uncommitted with the reason, and nothing else on main is touched", () => {
		f.git(f.main, "checkout", "-q", "-b", "elsewhere");
		const head = f.git(f.main, "rev-parse", "HEAD");
		const r = appendDecision(f.main, "seat-holds", entry("Approve"));
		expect(r.commit.committed).toBe(false);
		expect(!r.commit.committed && r.commit.reason).toMatch(/elsewhere/);
		expect(f.git(f.main, "rev-parse", "HEAD")).toBe(head);
		expect(f.git(f.main, "diff", "--cached", "--name-only")).toBe("");
		expect(f.git(f.main, "status", "--porcelain", "-uall").split("\n").filter(Boolean)).toEqual([
			expect.stringMatching(/plan-history\/seat-holds\.md$/),
		]);
	});
});
