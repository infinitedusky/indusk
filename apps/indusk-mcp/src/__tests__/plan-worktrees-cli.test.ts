import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	PLAN,
	type PlanWorktreeProject,
	planWorktreeProject,
} from "./helpers/plan-worktree-fixture.js";
import { git } from "./helpers/test-git.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * admin-plan-worktrees — A8–A13: making and ending an assignment, at the CLI.
 *
 * Each row runs the built CLI against a temp repository with real worktrees.
 * Today `worktree create` refuses outside a workbench and `assign` / `release`
 * are unknown commands, so every row is red at the boundary. Where a row
 * asserts that "the plan reads from" a copy, it asks the MCP plan tool — the
 * reader a person actually uses — rather than peeking at the record.
 */

let p: PlanWorktreeProject;

beforeEach(() => {
	p = planWorktreeProject("apw-cli");
});
afterEach(() => p.cleanup());

async function statusOf(from: string): Promise<Record<string, unknown>> {
	const tools = toolCaller((server) => registerPlanTools(server, from));
	const { json } = await tools.call("get_plan_status", { name: PLAN });
	return json as Record<string, unknown>;
}

function clean(dir: string): void {
	expect(git(dir, ["status", "--porcelain"]), `git status in ${dir}`).toBe("");
}

describe.skipIf(SHOULD_SKIP)("admin-plan-worktrees CLI", () => {
	it("A8 — `worktree create <plan>` in a normal repo creates plan/<plan> and the plan reads from it", async () => {
		const r = runCli(p.trunk, ["worktree", "create", PLAN]);
		expect(r.code, r.stderr).toBe(0);
		const expected = join(p.base, "proj-worktrees", PLAN);
		expect(existsSync(expected)).toBe(true);
		expect(git(expected, ["branch", "--show-current"])).toBe(`plan/${PLAN}`);
		p.checkOff(realpathSync(expected), "first item");
		const status = await statusOf(p.trunk);
		expect(status.worktree).toMatchObject({ path: realpathSync(expected), branch: `plan/${PLAN}` });
	});

	it("A9 — `worktree assign <plan> <path>` assigns a hand-made worktree and the plan reads from it", async () => {
		const wt = p.addWorktree("by-hand", "feature/anything");
		p.checkOff(wt, "first item");
		const r = runCli(p.trunk, ["worktree", "assign", PLAN, wt]);
		expect(r.code, r.stderr).toBe(0);
		const status = await statusOf(p.trunk);
		expect(status.worktree).toMatchObject({ path: wt, branch: "feature/anything" });
		const phases = status.phases as { checkedItems: number }[];
		expect(phases[0].checkedItems).toBe(1);
	});

	it("A10 — a second live assignment for the same plan is refused naming both, and nothing changes", () => {
		const first = p.addWorktree("first", "plan/demo");
		const second = p.addWorktree("second", "plan/demo-again");
		expect(runCli(p.trunk, ["worktree", "assign", PLAN, first]).code).toBe(0);
		const before = p.readRecord();
		const r = runCli(p.trunk, ["worktree", "assign", PLAN, second]);
		expect(r.code).not.toBe(0);
		const out = `${r.stdout}\n${r.stderr}`;
		expect(out).toContain(first);
		expect(out).toContain(second);
		expect(p.readRecord()).toBe(before);
	});

	it("A11 — a path that is not a worktree of this repo, or a plan with no folder, is refused by name", () => {
		const wt = p.addWorktree("real", "plan/demo");
		const stranger = join(p.base, "not-a-worktree");
		mkdirSync(stranger);

		const notWorktree = runCli(p.trunk, ["worktree", "assign", PLAN, stranger]);
		expect(notWorktree.code).not.toBe(0);
		expect(`${notWorktree.stdout}\n${notWorktree.stderr}`).toContain(stranger);
		// The refusal must be a refusal of the path, not of the command.
		expect(notWorktree.stderr).not.toMatch(/unknown command/i);

		const noPlan = runCli(p.trunk, ["worktree", "assign", "no-such-plan", wt]);
		expect(noPlan.code).not.toBe(0);
		expect(`${noPlan.stdout}\n${noPlan.stderr}`).toContain("no-such-plan");
		expect(noPlan.stderr).not.toMatch(/unknown command/i);
		expect(p.readRecord()).toBeNull();
	});

	it("A12 — `worktree release <plan>` ends the assignment and the plan reads from trunk", async () => {
		const wt = p.addWorktree("to-release", "plan/demo");
		p.checkOff(wt, "first item");
		expect(runCli(p.trunk, ["worktree", "assign", PLAN, wt]).code).toBe(0);
		// Read from the worktree while assigned — without this, "reads from trunk
		// after release" is also what a reader that ignores assignments shows.
		const assigned = await statusOf(p.trunk);
		expect(assigned.worktree).toMatchObject({ path: wt });
		const r = runCli(p.trunk, ["worktree", "release", PLAN]);
		expect(r.code, r.stderr).toBe(0);
		const status = await statusOf(p.trunk);
		expect(status.worktree).toBeUndefined();
		const phases = status.phases as { checkedItems: number }[];
		expect(phases[0].checkedItems).toBe(0);
	});

	it("A13 — create, assign, read and release leave git status clean in every checkout", async () => {
		const created = runCli(p.trunk, ["worktree", "create", PLAN]);
		expect(created.code, created.stderr).toBe(0);
		const wt = realpathSync(join(p.base, "proj-worktrees", PLAN));
		clean(p.trunk);
		clean(wt);
		await statusOf(p.trunk);
		clean(p.trunk);
		expect(runCli(p.trunk, ["worktree", "release", PLAN]).code).toBe(0);
		expect(runCli(p.trunk, ["worktree", "assign", PLAN, wt]).code).toBe(0);
		clean(p.trunk);
		clean(wt);
	});
});
