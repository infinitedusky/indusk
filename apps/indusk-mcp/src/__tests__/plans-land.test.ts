import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git as gitResult, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { implText } from "./helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: nothing-ships-until-accepted — admin-plan-authoring A18.
 *
 * A plan's build reaches `main` only once it is accepted. `plans land`
 * refuses an unaccepted plan, naming it, and leaves `main` alone; after
 * `plans accept` it merges the branch, removes the worktree and deletes the
 * branch. Through the CLI.
 */

const PLAN = "seat-holds";
const planDir = `.indusk/planning/${PLAN}`;

let p: PlanLifecycleProject;
let wt: string;
beforeEach(() => {
	p = planLifecycleProject("plans-land");
	wt = p.makeWorktree(PLAN);
	p.commit(
		wt,
		{
			[`${planDir}/impl.md`]: implText(PLAN, { status: "completed", rows: [{ state: "passing" }] }),
			"src/seat.ts": "export const seat = 1;\n",
		},
		"the build",
	);
});
afterEach(() => p.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

describe.skipIf(SHOULD_SKIP)("indusk plans land", () => {
	it("A18 — an unaccepted plan is refused, naming it; main unchanged and the worktree kept", () => {
		const before = p.mainSha();
		const r = runCli(p.trunk, ["plans", "land", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain(PLAN);
		expect(out(r)).toMatch(/accept/i);
		expect(p.mainSha()).toBe(before);
		expect(existsSync(wt)).toBe(true);
	});

	it("A18 — once accepted, it merges into main, and the worktree and branch are gone", () => {
		const accept = runCli(p.trunk, ["plans", "accept", PLAN]);
		expect(accept.code, out(accept)).toBe(0);
		const impl = matter(readFileSync(join(wt, planDir, "impl.md"), "utf-8"));
		expect(impl.data.accepted).toBeTruthy();
		expect(impl.data.accepted_by).toBe("person");

		const r = runCli(p.trunk, ["plans", "land", PLAN]);
		expect(r.code, out(r)).toBe(0);
		expect(p.onMain()).toContain("src/seat.ts");
		expect(git(p.trunk, ["rev-list", "--parents", "-n", "1", "main"]).split(" ")).toHaveLength(3);
		expect(existsSync(wt)).toBe(false);
		expect(gitResult(p.trunk, ["rev-parse", "--verify", `plan/${PLAN}`]).code).not.toBe(0);
	});

	it("A32 — InDusk's own notes left uncommitted on main are committed as bookkeeping, and the plan lands", () => {
		writeFileSync(
			join(p.trunk, ".indusk", "current.md"),
			"# now\n\n## Session abc — eval\n\nfinished\n",
		);
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const r = runCli(p.trunk, ["plans", "land", PLAN]);
		expect(r.code, out(r)).toBe(0);
		expect(git(p.trunk, ["log", "--format=%s", "main"])).toMatch(/bookkeeping/);
		expect(git(p.trunk, ["status", "--porcelain"])).toBe("");
		expect(p.onMain()).toContain("src/seat.ts");
	});

	it("A32 — other uncommitted work on main where the plan lands is refused, naming it, and not committed", () => {
		writeFileSync(join(p.trunk, "src-seat-draft.txt"), "someone's draft\n");
		mkdirSync(join(p.trunk, "src"), { recursive: true });
		writeFileSync(join(p.trunk, "src", "seat.ts"), "// someone else's seat\n");
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const before = p.mainSha();
		const r = runCli(p.trunk, ["plans", "land", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain("src/seat.ts");
		expect(p.mainSha()).toBe(before);
	});
});
