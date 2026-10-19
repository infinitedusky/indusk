// clause: a-brief-is-accepted-on-current-main/a-conflict-refuses
// clause: a-brief-is-accepted-on-current-main/the-person-never-merges
// promise: a-brief-is-accepted-on-current-main
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { acceptBrief } from "./accept-brief.js";
import { PlanCommandRefusal } from "./plan-branch.js";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1: when bringing main in
 * cannot be done, the acceptance is refused in plain words naming each file,
 * and nothing is changed — the brief a draft, the tree clean, the head where
 * it was.
 */

const PLAN = "seat-holds";
const draft = (text: string) => text.replace("status: accepted", "status: draft");
const briefPath = ".indusk/planning/seat-holds/brief.md";
const NOTES = "docs/notes.md";
const base = "a\nb\nc\n";
const withLine = (line: string) => `a\n${line}\nc\n`;

let p: PlanLifecycleProject;
let wt: string;
let previous: string | undefined;
beforeEach(() => {
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	p = planLifecycleProject("accept-brief-conflict");
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	p.cleanup();
});

/** Main holds `files` and the draft brief; the plan's worktree is cut from there. */
function cutFromMain(files: Record<string, string>): void {
	p.commit(p.trunk, { ...files, [briefPath]: draft(briefText(PLAN)) }, "base");
	wt = p.makeWorktree(PLAN);
}

const refusal = async (): Promise<string> => {
	const err = await acceptBrief(p.trunk, PLAN).then(
		() => null,
		(e: unknown) => e,
	);
	expect(err).toBeInstanceOf(PlanCommandRefusal);
	return (err as Error).message;
};

function expectUntouched(head: string): void {
	expect(git(wt, ["status", "--porcelain"])).toBe("");
	expect(() => git(wt, ["rev-parse", "-q", "--verify", "MERGE_HEAD"])).toThrow();
	expect(git(wt, ["diff", "--name-only", "--diff-filter=U"])).toBe("");
	expect(git(wt, ["rev-parse", "HEAD"])).toBe(head);
	const brief = readFileSync(join(wt, briefPath), "utf-8");
	expect(brief).toContain("status: draft");
	expect(brief).not.toContain("accepted_at");
}

describe("a conflict refuses the acceptance", () => {
	it("A9: main and the branch changed the same lines, the refusal names the path", async () => {
		cutFromMain({ [NOTES]: base });
		p.commit(wt, { [NOTES]: withLine("mine") }, "mine");
		p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
		const message = await refusal();
		expect(message).toContain(NOTES);
		expect(message).toContain("nothing was changed");
	});

	it("A9: a file with uncommitted changes in the merge's way is named, as belonging to whoever made it", async () => {
		cutFromMain({ [NOTES]: base });
		const head = git(wt, ["rev-parse", "HEAD"]);
		p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
		writeFileSync(join(wt, NOTES), withLine("not committed"));
		const message = await refusal();
		expect(message).toContain(NOTES);
		expect(message).toContain("nothing was changed");
		expect(message).toMatch(/whoever made/);
		expect(git(wt, ["rev-parse", "HEAD"])).toBe(head);
		expect(readFileSync(join(wt, NOTES), "utf-8")).toBe(withLine("not committed"));
	});

	it("A10: two files in conflict are each on their own line; a clean merge elsewhere is not named", async () => {
		cutFromMain({ [NOTES]: base, "docs/more.md": base, "docs/clean.md": base });
		p.commit(wt, { [NOTES]: withLine("mine"), "docs/more.md": withLine("mine") }, "mine");
		p.commit(
			p.trunk,
			{ [NOTES]: withLine("theirs"), "docs/more.md": withLine("theirs"), "docs/clean.md": withLine("x") },
			"theirs",
		);
		const lines = (await refusal()).split("\n").map((l) => l.trim());
		expect(lines).toContain(NOTES);
		expect(lines).toContain("docs/more.md");
		expect(lines).not.toContain("docs/clean.md");
	});

	it("A11: after the refusal the brief is a draft, the tree clean, no merge in progress, the head unmoved", async () => {
		cutFromMain({ [NOTES]: base });
		p.commit(wt, { [NOTES]: withLine("mine") }, "mine");
		p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
		const head = git(wt, ["rev-parse", "HEAD"]);
		await refusal();
		expectUntouched(head);
		expect(readFileSync(join(wt, NOTES), "utf-8")).toBe(withLine("mine"));
	});

	it("A13: accepting again once the conflict is gone succeeds", async () => {
		cutFromMain({ [NOTES]: base });
		p.commit(wt, { [NOTES]: withLine("mine") }, "mine");
		p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
		await refusal();
		p.commit(wt, { [NOTES]: withLine("theirs") }, "settled");
		await acceptBrief(p.trunk, PLAN);
		expect(readFileSync(join(wt, briefPath), "utf-8")).toContain("status: accepted");
	});

	it("A14: the refusal is the plan command's own, saying what to resolve and that nothing was changed", async () => {
		cutFromMain({ [NOTES]: base });
		p.commit(wt, { [NOTES]: withLine("mine") }, "mine");
		p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
		const message = await refusal();
		expect(message).toMatch(/resolve/i);
		expect(message).toContain("nothing was changed");
	});

	it("A15: a conflict in the brief itself refuses the same way", async () => {
		cutFromMain({ [NOTES]: base });
		const edit = (text: string, to: string) => text.replace("# seat-holds — Brief", to);
		const head0 = readFileSync(join(wt, briefPath), "utf-8");
		p.commit(wt, { [briefPath]: edit(head0, "# mine") }, "my brief");
		p.commit(p.trunk, { [briefPath]: edit(head0, "# theirs") }, "their brief");
		const head = git(wt, ["rev-parse", "HEAD"]);
		const message = await refusal();
		expect(message).toContain(briefPath);
		expectUntouched(head);
	});

	it("A19: neither the conflict nor the uncommitted-files refusal tells the person to merge or quotes git", async () => {
		cutFromMain({ [NOTES]: base });
		p.commit(wt, { [NOTES]: withLine("mine") }, "mine");
		p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
		const conflict = await refusal();
		cutFromMainAgain();
		const dirty = await refusalWithUncommitted();
		for (const message of [conflict, dirty]) {
			expect(message).not.toMatch(/Command failed|\bgit\b/);
			expect(message).not.toMatch(/\b(merge|rebase|pull|commit|stash)\b/i);
		}
	});

	it("A28: main changing this plan's own brief, without a conflict, refuses naming it", async () => {
		cutFromMain({ [NOTES]: base });
		const text = readFileSync(join(wt, briefPath), "utf-8");
		p.commit(p.trunk, { [briefPath]: `${text}\nAdded on main.\n` }, "main edits the brief");
		const head = git(wt, ["rev-parse", "HEAD"]);
		const message = await refusal();
		expect(message).toContain("brief.md");
		expectUntouched(head);
		expect(existsSync(join(wt, NOTES))).toBe(true);
	});
});

/** A second plan worktree for the uncommitted case inside one test. */
function cutFromMainAgain(): void {
	p.cleanup();
	p = planLifecycleProject("accept-brief-conflict");
	cutFromMain({ [NOTES]: base });
}
async function refusalWithUncommitted(): Promise<string> {
	p.commit(p.trunk, { [NOTES]: withLine("theirs") }, "theirs");
	writeFileSync(join(wt, NOTES), withLine("not committed"));
	return refusal();
}
