// clause: a-brief-is-accepted-on-current-main/main-is-merged-first
// clause: a-brief-is-accepted-on-current-main/the-person-never-merges
// promise: a-plan-is-written-on-its-own-branch
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { writePromise } from "../../__tests__/helpers/promises-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { acceptBrief } from "./accept-brief.js";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1: accepting a brief first
 * brings main into the plan's branch, in the plan's worktree, then marks the
 * brief accepted. Real git in a temporary repository; nothing is fetched.
 */

const PLAN = "seat-holds";
const draft = (text: string) => text.replace("status: accepted", "status: draft");
const briefPath = ".indusk/planning/seat-holds/brief.md";

let p: PlanLifecycleProject;
let wt: string;
let previous: string | undefined;
beforeEach(() => {
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	p = planLifecycleProject("accept-brief-main");
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	p.cleanup();
});

/** The plan's worktree with a draft brief committed, main then one commit ahead of it. */
function behindMain(files: Record<string, string> = { "docs/from-main.md": "main\n" }): void {
	wt = p.makeWorktree(PLAN);
	p.commit(wt, { [briefPath]: draft(briefText(PLAN)) }, "the brief");
	p.commit(p.trunk, files, "main moves");
}
const subjects = (args: string[] = []) => git(wt, ["log", "--first-parent", "--format=%s", ...args]).split("\n");

describe("accepting a brief brings main in first", () => {
	it("A1: a file main gained after the branch was cut is in the worktree, and the brief reads accepted", async () => {
		behindMain();
		await acceptBrief(p.trunk, PLAN);
		expect(existsSync(join(wt, "docs", "from-main.md"))).toBe(true);
		expect(readFileSync(join(wt, briefPath), "utf-8")).toContain("status: accepted");
	});

	it("A2: main's head is in the history before the commit that marks the brief accepted", async () => {
		behindMain();
		const main = p.mainSha();
		await acceptBrief(p.trunk, PLAN);
		expect(() => git(wt, ["merge-base", "--is-ancestor", main, "HEAD"])).not.toThrow();
		const log = subjects();
		expect(log[0]).toBe(`plan(${PLAN}): brief accepted`);
		expect(log[1]).toMatch(/merged/);
	});

	it("A3: a branch that already holds main gains no merge commit, only the acceptance", async () => {
		wt = p.makeWorktree(PLAN);
		p.commit(wt, { [briefPath]: draft(briefText(PLAN)) }, "the brief");
		const before = git(wt, ["rev-parse", "HEAD"]);
		await acceptBrief(p.trunk, PLAN);
		expect(git(wt, ["rev-list", "--count", `${before}..HEAD`])).toBe("1");
		expect(git(wt, ["rev-list", "--merges", `${before}..HEAD`])).toBe("");
	});

	it("A4: a branch both ahead of and behind main keeps every one of its commits", async () => {
		behindMain();
		p.commit(wt, { "docs/mine.md": "mine\n" }, "my work");
		const own = git(wt, ["rev-list", "main..HEAD"]).split("\n");
		await acceptBrief(p.trunk, PLAN);
		const after = git(wt, ["rev-list", "HEAD"]).split("\n");
		for (const sha of own) expect(after).toContain(sha);
	});

	it("A5: the brief changes only by its status and acceptance time, while main's other plans arrive", async () => {
		behindMain({ ".indusk/planning/other-plan/brief.md": "other\n" });
		const before = git(wt, ["rev-parse", "HEAD"]);
		await acceptBrief(p.trunk, PLAN);
		const changed = git(wt, ["diff", "-U0", before, "HEAD", "--", briefPath])
			.split("\n")
			.filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
		expect(changed.length).toBeGreaterThan(0);
		for (const line of changed) expect(line).toMatch(/^[+-](status|accepted_at):/);
		expect(existsSync(join(wt, ".indusk", "planning", "other-plan", "brief.md"))).toBe(true);
	});

	it("A6: a brief that passes before main is in and fails after is refused, the branch as it was", async () => {
		const spec = {
			name: "seat-promise",
			kind: "state" as const,
			domain: "seating",
			owner: "seats",
		};
		writePromise(join(p.trunk, ".indusk", "promises"), { ...spec, state: "enforced" });
		git(p.trunk, ["add", "-A"]);
		git(p.trunk, ["commit", "-q", "-m", "promise"]);
		wt = p.makeWorktree(PLAN);
		p.commit(wt, { [briefPath]: draft(briefText(PLAN, { mustNotBreak: ["seat-promise"] })) }, "the brief");
		const retired = writePromise(join(p.trunk, ".indusk", "promises"), { ...spec, state: "retired" });
		expect(retired).toContain("seat-promise");
		git(p.trunk, ["add", "-A"]);
		git(p.trunk, ["commit", "-q", "-m", "main retires the promise"]);
		const before = git(wt, ["rev-parse", "HEAD"]);
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow(/seat-promise/);
		expect(git(wt, ["rev-parse", "HEAD"])).toBe(before);
		expect(git(wt, ["status", "--porcelain"])).toBe("");
		expect(readFileSync(join(wt, briefPath), "utf-8")).toContain("status: draft");
	});

	it("A26: a skill that changed on main after the branch was cut is in the worktree after accepting", async () => {
		behindMain({ ".claude/skills/audit/SKILL.md": "audit concerns are answered\n" });
		await acceptBrief(p.trunk, PLAN);
		expect(readFileSync(join(wt, ".claude", "skills", "audit", "SKILL.md"), "utf-8")).toContain(
			"answered",
		);
	});

	it("A27: the merge commit's message names the plan and main", async () => {
		behindMain();
		await acceptBrief(p.trunk, PLAN);
		expect(git(wt, ["log", "-1", "--merges", "--format=%s"])).toBe(
			`plan(${PLAN}): main merged before its brief was accepted`,
		);
	});
});

describe("guards: what accepting must not do", () => {
	it("A18: a brief that fails its contract is refused with the check's messages and main is not merged in", async () => {
		behindMain();
		p.commit(wt, { [briefPath]: draft(briefText(PLAN, { mustNotBreak: ["no-such-promise"] })) }, "bad");
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow(/no-such-promise/);
		expect(existsSync(join(wt, "docs", "from-main.md"))).toBe(false);
	});

	it("A20: a session inside a build step is refused before anything is merged", async () => {
		behindMain();
		const before = git(wt, ["rev-parse", "HEAD"]);
		process.env[BUILD_STEP_ENV] = "plan-impl";
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow(/plan-impl/);
		expect(git(wt, ["rev-parse", "HEAD"])).toBe(before);
		expect(existsSync(join(wt, "docs", "from-main.md"))).toBe(false);
	});

	it("A24: main's head is the commit it was at after an accepted and after a refused acceptance", async () => {
		behindMain();
		const main = p.mainSha();
		await acceptBrief(p.trunk, PLAN);
		expect(p.mainSha()).toBe(main);
		p.commit(wt, { [briefPath]: draft(briefText(PLAN, { mustNotBreak: ["no-such-promise"] })) }, "bad");
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow();
		expect(p.mainSha()).toBe(main);
	});

	it("A25: accepting from the main checkout commits on the plan's branch, never on main", async () => {
		behindMain();
		await acceptBrief(p.trunk, PLAN);
		expect(git(p.trunk, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
		expect(git(p.trunk, ["log", "-1", "--format=%s"])).toBe("main moves");
		expect(git(wt, ["log", "-1", "--format=%s"])).toBe(`plan(${PLAN}): brief accepted`);
	});
});
