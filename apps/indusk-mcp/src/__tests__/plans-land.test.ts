import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bookkeepingRoots } from "../lib/bookkeeping/roots.js";
import { git as gitResult, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { implText } from "./helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: nothing-ships-until-accepted — admin-plan-authoring A18.
 * promise: indusk-leaves-main-clean — bookkeeping-lives-where-it-is-read A16.
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

	it("A16 — a branch that still tracks a changed highlights queue lands after main stopped tracking it", () => {
		const home = mkdtempSync(join(tmpdir(), "plans-land-home-"));
		const env = { INDUSK_HOME: home };
		const h = (id: string, note: string) =>
			`${JSON.stringify({ id, timestamp: "2026-10-07T00:00:00Z", level: "note", tag: "t", note })}\n`;
		try {
			p.commit(
				p.trunk,
				{ ".indusk/highlights.jsonl": h("h-1", "before the move") },
				"queue tracked",
			);
			git(wt, ["merge", "-q", "main"]);
			p.commit(
				wt,
				{
					".indusk/highlights.jsonl":
						h("h-1", "before the move") + h("h-2", "from the plan's sessions"),
				},
				"the plan's sessions highlighted",
			);
			// What `indusk update` does on main: out of git, ignored.
			git(p.trunk, ["rm", "-q", "--cached", ".indusk/highlights.jsonl"]);
			rmSync(join(p.trunk, ".indusk", "highlights.jsonl"));
			p.commit(
				p.trunk,
				{ ".gitignore": ".indusk/highlights.jsonl\n" },
				"chore(indusk): highlights move to the home",
			);

			expect(runCli(p.trunk, ["plans", "accept", PLAN], env).code).toBe(0);
			const r = runCli(p.trunk, ["plans", "land", PLAN], env);
			expect(r.code, out(r)).toBe(0);
			expect(p.onMain()).toContain("src/seat.ts");
			expect(p.onMain()).not.toContain(".indusk/highlights.jsonl");
			expect(git(p.trunk, ["status", "--porcelain"])).toBe("");
			const previous = process.env.INDUSK_HOME;
			process.env.INDUSK_HOME = home;
			const queue = join(bookkeepingRoots(p.trunk).home, "highlights.jsonl");
			if (previous === undefined) delete process.env.INDUSK_HOME;
			else process.env.INDUSK_HOME = previous;
			expect(existsSync(queue) ? readFileSync(queue, "utf-8") : "").toContain(
				"from the plan's sessions",
			);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
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

	it("A37 — a staged rename of the person's file onto a path the plan touches is named by its new path", () => {
		p.commit(p.trunk, { "src/draft.ts": "// someone's draft\n" }, "a draft");
		git(wt, ["merge", "-q", "main"]);
		p.commit(wt, { "src/draft.ts": "// the plan's edit\n" }, "the plan edits the draft");
		git(p.trunk, ["mv", "src/draft.ts", "src/seat.ts"]);
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const before = p.mainSha();
		const r = runCli(p.trunk, ["plans", "land", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain("src/seat.ts");
		expect(out(r)).not.toContain("->");
		expect(p.mainSha()).toBe(before);
	});

	// A35: a build step's session may run any shell command, so `accept` and
	// `land` themselves refuse inside one. The release session (the
	// retrospective, started by acceptance) is not a build step and lands.
	it("A35 — inside a build step, accept is refused naming the step, and nothing is recorded", () => {
		const r = runCli(p.trunk, ["plans", "accept", PLAN], { INDUSK_BUILD_STEP: "work" });
		expect(r.code).not.toBe(0);
		expect(out(r)).toMatch(/build step/i);
		expect(out(r)).toContain("work");
		const impl = matter(readFileSync(join(wt, planDir, "impl.md"), "utf-8"));
		expect(impl.data.accepted).toBeUndefined();
	});

	it("A35 — inside a build step, land is refused naming the step, even for an accepted plan", () => {
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const before = p.mainSha();
		const r = runCli(p.trunk, ["plans", "land", PLAN], { INDUSK_BUILD_STEP: "cleanup" });
		expect(r.code).not.toBe(0);
		expect(out(r)).toMatch(/build step/i);
		expect(out(r)).toContain("cleanup");
		expect(p.mainSha()).toBe(before);
		expect(existsSync(wt)).toBe(true);
	});

	it("A35 — the release session, outside any build step, still lands", () => {
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const r = runCli(p.trunk, ["plans", "land", PLAN], { INDUSK_BUILD_STEP: undefined });
		expect(r.code, out(r)).toBe(0);
		expect(p.onMain()).toContain("src/seat.ts");
	});
});
