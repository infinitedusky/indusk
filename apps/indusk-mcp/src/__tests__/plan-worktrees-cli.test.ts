import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { CLI_BIN, runCli, SHOULD_SKIP } from "./helpers/cli.js";
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

/** Run the built CLI without waiting, so several can race. INDUSK_HOME pinned to a temp dir, as `runCli` does. */
function spawnCli(cwd: string, args: string[], home: string): Promise<number> {
	return new Promise((resolveExit) => {
		const child = spawn("node", [CLI_BIN, ...args], {
			cwd,
			env: { ...process.env, INDUSK_HOME: home },
			stdio: "ignore",
		});
		child.on("close", (code) => resolveExit(code ?? 1));
	});
}

describe.skipIf(SHOULD_SKIP)("admin-plan-worktrees CLI — falsification", () => {
	it("A23 — twelve assigns started at once leave all twelve assignments in the record", async () => {
		const plans = Array.from({ length: 12 }, (_, i) => `race-${i}`);
		for (const plan of plans) {
			mkdirSync(join(p.trunk, ".indusk", "planning", plan), { recursive: true });
			writeFileSync(
				join(p.trunk, ".indusk", "planning", plan, "brief.md"),
				`---\ntitle: ${plan}\nstatus: draft\n---\n\n# ${plan}\n`,
			);
		}
		git(p.trunk, ["add", "-A"]);
		git(p.trunk, ["commit", "-q", "-m", "twelve plans"]);
		const worktrees = plans.map((plan) => p.addWorktree(`wt-${plan}`, `plan/${plan}`));
		const home = mkdtempSync(join(tmpdir(), "apw-race-home-"));
		try {
			const codes = await Promise.all(
				plans.map((plan, i) => spawnCli(p.trunk, ["worktree", "assign", plan, worktrees[i]], home)),
			);
			expect(
				codes.every((c) => c === 0),
				`exit codes ${codes.join(",")}`,
			).toBe(true);
			const record = JSON.parse(p.readRecord() ?? "{}") as { assignments?: { plan: string }[] };
			const recorded = new Set((record.assignments ?? []).map((a) => a.plan));
			expect(
				[...plans].filter((plan) => !recorded.has(plan)),
				"assignments lost",
			).toEqual([]);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	}, 60_000);

	it("A24 — create refuses a leftover plain folder as not a worktree, and never advises assign", () => {
		const leftover = join(p.base, "proj-worktrees", PLAN);
		mkdirSync(join(leftover, "node_modules"), { recursive: true });
		writeFileSync(join(leftover, "node_modules", ".keep"), "");
		const r = runCli(p.trunk, ["worktree", "create", PLAN]);
		expect(r.code).not.toBe(0);
		const out = `${r.stdout}\n${r.stderr}`;
		expect(out).toContain(leftover);
		expect(out).toMatch(/not a worktree/i);
		expect(out).not.toContain("worktree assign");
	});

	it("A25 — create refuses when the trunk is on a branch that is not a trunk branch", () => {
		git(p.trunk, ["checkout", "-q", "-b", "feature/unmerged"]);
		const r = runCli(p.trunk, ["worktree", "create", PLAN]);
		expect(r.code).not.toBe(0);
		expect(`${r.stdout}\n${r.stderr}`).toContain("feature/unmerged");
		expect(git(p.trunk, ["branch", "--list", `plan/${PLAN}`])).toBe("");
	});
});
