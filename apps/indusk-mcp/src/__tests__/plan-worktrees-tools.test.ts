import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import {
	PLAN,
	type PlanWorktreeProject,
	planWorktreeProject,
	RECORD_FILE,
} from "./helpers/plan-worktree-fixture.js";
import { git } from "./helpers/test-git.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * admin-plan-worktrees — the MCP plan tools read a plan's live copy.
 *
 * A5, A6, A17, and the tools halves of A7, A14, A16. The record is written by
 * hand here (the fixture's `writeRecord`), so these rows depend only on the
 * tools reading it — the CLI that writes it is A8–A13's subject. Today the
 * tools read the checkout they were started in, so every row but A7 is red
 * on its own assertion.
 */

let p: PlanWorktreeProject;

beforeEach(() => {
	p = planWorktreeProject("apw-tools");
});
afterEach(() => p.cleanup());

function tools(from: string) {
	return toolCaller((server) => registerPlanTools(server, from));
}

type Status = {
	stageStatus?: string;
	implStatus?: string;
	worktree?: { name: string; path: string; branch: string };
	copyProblem?: { kind: string; detail: string };
	phases?: { checkedItems: number }[];
	error?: string;
	file?: string;
};

async function status(from: string): Promise<Status> {
	return (await tools(from).call("get_plan_status", { name: PLAN })).json as Status;
}

/** An assigned worktree with one item checked and the impl moved to in-progress. */
function assignedWorktree(): string {
	const wt = p.addWorktree("wt-alpha", "plan/demo");
	p.checkOff(wt, "first item");
	p.setImplStatus(wt, "in-progress");
	p.writeRecord([{ plan: PLAN, path: wt, branch: "plan/demo" }]);
	return wt;
}

describe("A5 — asked at trunk, the three plan tools report the worktree's state", () => {
	it("get_plan_status reads the worktree's checkoffs and names the worktree", async () => {
		const wt = assignedWorktree();
		const s = await status(p.trunk);
		expect(s.phases?.[0].checkedItems).toBe(1);
		expect(s.implStatus).toBe("in-progress");
		expect(s.worktree).toMatchObject({ name: "wt-alpha", path: wt, branch: "plan/demo" });
	});

	it("list_plans carries the worktree on the plan's entry", async () => {
		const wt = assignedWorktree();
		const { json } = await tools(p.trunk).call("list_plans", {});
		const entry = (json as { name: string; worktree?: { path: string } }[]).find(
			(x) => x.name === PLAN,
		);
		expect(entry?.worktree?.path).toBe(wt);
	});

	it("advance_plan no longer lists an item checked off in the worktree", async () => {
		assignedWorktree();
		const { json } = await tools(p.trunk).call("advance_plan", { name: PLAN });
		const missing = ((json as { missing?: string[] }).missing ?? []).join("\n");
		expect(missing).not.toContain("first item");
		expect(missing).toContain("second item");
	});
});

describe("A6 — asked from inside a worktree, the answers match those asked at trunk", () => {
	it("list_plans and get_plan_status are the same from the trunk, the assigned worktree and an unrelated one", async () => {
		const wt = assignedWorktree();
		const elsewhere = p.addWorktree("wt-other", "feature/other");
		const fromTrunk = await tools(p.trunk).call("list_plans", {});
		for (const from of [wt, elsewhere]) {
			const fromHere = await tools(from).call("list_plans", {});
			expect(fromHere.json, `list_plans from ${from}`).toEqual(fromTrunk.json);
			expect(await status(from), `get_plan_status from ${from}`).toEqual(await status(p.trunk));
		}
	});
});

describe("A7 — a plan with no assignment reads exactly as it does today (tools half)", () => {
	it("an unassigned hand-made worktree changes nothing about the trunk's answer", async () => {
		const before = await status(p.trunk);
		const wt = p.addWorktree("unassigned", "plan/demo");
		p.checkOff(wt, "first item");
		const after = await status(p.trunk);
		expect(after).toEqual(before);
		expect(after.worktree).toBeUndefined();
		expect(after.phases?.[0].checkedItems).toBe(0);
	});
});

describe("A14 — an assigned worktree removed without release is reported gone (tools half)", () => {
	it("get_plan_status names the missing worktree and shows the trunk copy", async () => {
		const wt = assignedWorktree();
		git(p.trunk, ["worktree", "remove", "--force", wt]);
		const s = await status(p.trunk);
		expect(s.copyProblem?.kind).toBe("gone");
		expect(s.copyProblem?.detail).toContain(wt);
		expect(s.phases?.[0].checkedItems).toBe(0);
		expect(s.worktree).toBeUndefined();
	});
});

describe("A16 — a malformed record is an error naming the file (tools half)", () => {
	it.each([
		"list_plans",
		"get_plan_status",
		"advance_plan",
	])("%s refuses rather than guessing a copy", async (tool) => {
		p.writeRecordRaw("{ this is not json");
		const r = await tools(p.trunk).call(tool, { name: PLAN });
		expect(r.isError).toBe(true);
		const body = r.json as { error?: string; file?: string };
		expect(body.file ?? "").toContain(RECORD_FILE);
		expect(body.error ?? "").not.toBe("");
	});
});

describe("A17 — two live assignments for one plan are an error naming both", () => {
	it("get_plan_status reports both worktrees and picks neither", async () => {
		const a = p.addWorktree("wt-a", "plan/demo");
		const b = p.addWorktree("wt-b", "plan/demo-b");
		p.checkOff(a, "first item");
		p.writeRecord([
			{ plan: PLAN, path: a, branch: "plan/demo" },
			{ plan: PLAN, path: b, branch: "plan/demo-b" },
		]);
		const s = await status(p.trunk);
		expect(s.copyProblem?.kind).toBe("doubled");
		expect(s.copyProblem?.detail).toContain(a);
		expect(s.copyProblem?.detail).toContain(b);
		expect(s.worktree).toBeUndefined();
		expect(s.phases?.[0].checkedItems).toBe(0);
	});
});
