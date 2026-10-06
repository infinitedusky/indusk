import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { git } from "./helpers/test-git.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * promise: a-plan-is-written-on-its-own-branch — admin-plan-authoring A7, A8, A10.
 *
 * Starting a plan, with its type and its name, gives it its own branch and
 * worktree, recorded so every reader finds the plan there; its documents are
 * written there and nowhere on `main`; and a name already in use is refused,
 * saying what uses it. Through the CLI, in a real repository.
 */

const PLAN = "seat-holds";

let p: PlanLifecycleProject;
beforeEach(() => {
	p = planLifecycleProject("plans-start");
});
afterEach(() => p.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

describe.skipIf(SHOULD_SKIP)("indusk plans start", () => {
	it("A7 — creates plan/<name> and its worktree, records it, and writes the brief with the type", () => {
		const r = runCli(p.trunk, ["plans", "start", "feature", PLAN]);
		expect(r.code, out(r)).toBe(0);

		const wt = p.worktreeOf(PLAN);
		expect(existsSync(wt), `no worktree at ${wt}`).toBe(true);
		expect(git(wt, ["branch", "--show-current"])).toBe(`plan/${PLAN}`);

		const common = git(p.trunk, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
		const record = JSON.parse(readFileSync(join(common, "indusk-plan-worktrees.json"), "utf-8"));
		expect(record.assignments).toEqual([
			expect.objectContaining({ plan: PLAN, path: realpathSync(wt), branch: `plan/${PLAN}` }),
		]);

		const brief = matter(readFileSync(join(wt, ".indusk", "planning", PLAN, "brief.md"), "utf-8"));
		expect(brief.data).toMatchObject({ status: "draft", workflow: "feature" });
	});

	it("A7 — the plan tools read the plan from its worktree, though the trunk has no folder for it", async () => {
		expect(runCli(p.trunk, ["plans", "start", "feature", PLAN]).code).toBe(0);
		const tools = toolCaller((server) => registerPlanTools(server, p.trunk));
		const { json } = await tools.call("get_plan_status", { name: PLAN });
		expect(json).toMatchObject({
			worktree: { path: realpathSync(p.worktreeOf(PLAN)), branch: `plan/${PLAN}` },
		});
	});

	it("A8 — nothing of the plan is on main, in the trunk's working tree or in its history", () => {
		const r = runCli(p.trunk, ["plans", "start", "bugfix", PLAN]);
		expect(r.code, out(r)).toBe(0);

		expect(existsSync(join(p.trunk, ".indusk", "planning", PLAN))).toBe(false);
		expect(p.onMain().filter((f) => f.includes(PLAN))).toEqual([]);
		expect(git(p.trunk, ["status", "--porcelain"])).toBe("");
	});

	it("A10 — a name whose folder exists on main is refused, naming the folder", () => {
		mkdirSync(join(p.trunk, ".indusk", "planning", PLAN), { recursive: true });
		writeFileSync(join(p.trunk, ".indusk", "planning", PLAN, "brief.md"), "# taken\n");
		const r = runCli(p.trunk, ["plans", "start", "feature", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain(`.indusk/planning/${PLAN}`);
		expect(existsSync(p.worktreeOf(PLAN))).toBe(false);
	});

	it("A10 — a name whose branch exists is refused, naming the branch", () => {
		git(p.trunk, ["branch", `plan/${PLAN}`]);
		const r = runCli(p.trunk, ["plans", "start", "feature", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain(`plan/${PLAN}`);
		expect(existsSync(p.worktreeOf(PLAN))).toBe(false);
	});

	it("A10 — starting the same plan twice is refused, naming its worktree", () => {
		expect(runCli(p.trunk, ["plans", "start", "feature", PLAN]).code).toBe(0);
		const r = runCli(p.trunk, ["plans", "start", "feature", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain(realpathSync(p.worktreeOf(PLAN)));
	});

	it("A10 — a type that is not a workflow type is refused, naming the types", () => {
		const r = runCli(p.trunk, ["plans", "start", "epic", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toMatch(/feature.*bugfix|bugfix.*feature/s);
		expect(existsSync(p.worktreeOf(PLAN))).toBe(false);
	});
});
