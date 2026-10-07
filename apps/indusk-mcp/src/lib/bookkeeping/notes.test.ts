import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "./fixture.test-support.js";
import { addLesson, commitNote, writeCurrentSection } from "./notes.js";

/**
 * promise: indusk-leaves-main-clean — bookkeeping-lives-where-it-is-read A1, A2, A4, A5.
 *
 * Notes people read are written to the main checkout, whichever checkout the
 * writer runs in, and committed on `main` as they are written, in a commit of
 * their own; never onto another branch, never in the middle of a merge.
 */

let f: Fixture;
beforeEach(() => {
	f = makeFixture();
});
afterEach(() => f.cleanup());

const section = (sessionId: string, task: string) => ({
	sessionId,
	task,
	inFlight: "",
	openQuestions: "",
	cursor: "",
});
const clean = (cwd: string) => f.git(cwd, "status", "--porcelain");
const lastSubject = () => f.git(f.main, "log", "-1", "--format=%s", "main");

describe("notes are committed on main", () => {
	it("A1: a session's note from a plan worktree is in main's current.md and committed; neither checkout is dirty", () => {
		writeCurrentSection(f.worktree, section("aaaaaaaa-1", "from the worktree"));
		expect(existsSync(join(f.main, ".indusk", "current.md")), "written in the main checkout").toBe(
			true,
		);
		expect(readFileSync(join(f.main, ".indusk", "current.md"), "utf-8")).toContain(
			"from the worktree",
		);
		expect(
			existsSync(join(f.worktree, ".indusk", "current.md")),
			"nothing written in the worktree",
		).toBe(false);
		expect(clean(f.main)).toBe("");
		expect(clean(f.worktree)).toBe("");
		expect(lastSubject()).toMatch(/^chore\(indusk\): /);
	});

	it("A2: a lesson from a plan worktree is in main's lessons and committed", () => {
		const r = addLesson(f.worktree, {
			name: "a-test-lesson",
			title: "A test lesson",
			content: "Body.",
		});
		expect("file" in r && r.file).toBe(join(f.main, ".claude", "lessons", "a-test-lesson.md"));
		expect(clean(f.main)).toBe("");
		expect(clean(f.worktree)).toBe("");
		expect(lastSubject()).toMatch(/^chore\(indusk\): /);
	});

	it("A4: on main a note is committed; off the trunk branch or mid-merge it is left written, uncommitted, with the reason", () => {
		const note = (name: string) => {
			mkdirSync(join(f.main, ".indusk"), { recursive: true });
			writeFileSync(join(f.main, ".indusk", name), "note\n");
			return [join(".indusk", name)];
		};
		expect(commitNote(f.main, note("one.md"), "chore(indusk): one")).toEqual({ committed: true });

		f.git(f.main, "checkout", "-q", "-b", "elsewhere");
		const off = commitNote(f.main, note("two.md"), "chore(indusk): two");
		expect(off.committed).toBe(false);
		expect(!off.committed && off.reason).toMatch(/elsewhere/);
		expect(f.git(f.main, "log", "-1", "--format=%s", "elsewhere")).toBe("chore(indusk): one");

		f.git(f.main, "checkout", "-q", "main");
		writeFileSync(
			join(f.git(f.main, "rev-parse", "--git-dir"), "MERGE_HEAD"),
			`${f.git(f.main, "rev-parse", "HEAD")}\n`,
		);
		const merging = commitNote(f.main, note("three.md"), "chore(indusk): three");
		expect(merging.committed).toBe(false);
		expect(!merging.committed && merging.reason).toMatch(/merge/i);
	});

	it("A4: a person's own staged work is left staged, and not in InDusk's commit", () => {
		writeFileSync(join(f.main, "mine.txt"), "mine\n");
		f.git(f.main, "add", "mine.txt");
		mkdirSync(join(f.main, ".indusk"), { recursive: true });
		writeFileSync(join(f.main, ".indusk", "n.md"), "n\n");
		expect(commitNote(f.main, [".indusk/n.md"], "chore(indusk): n").committed).toBe(true);
		expect(f.git(f.main, "show", "--name-only", "--format=", "HEAD")).toBe(".indusk/n.md");
		expect(f.git(f.main, "diff", "--cached", "--name-only")).toBe("mine.txt");
	});

	it("A5: two sessions' notes are both written and both committed", () => {
		writeCurrentSection(f.worktree, section("aaaaaaaa-1", "first session"));
		writeCurrentSection(f.main, section("bbbbbbbb-2", "second session"));
		const md = readFileSync(join(f.main, ".indusk", "current.md"), "utf-8");
		expect(md).toContain("first session");
		expect(md).toContain("second session");
		expect(clean(f.main)).toBe("");
		expect(
			f
				.git(f.main, "log", "--format=%s", "main")
				.split("\n")
				.filter((s) => s.startsWith("chore(indusk)")),
		).toHaveLength(2);
	});
});
