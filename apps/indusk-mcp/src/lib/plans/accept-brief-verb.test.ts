// promise: an-accepted-brief-is-planned-unasked
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1 (A21, A22 from the command
 * line): accepting a brief behind main hands the plan to the planning run once,
 * after the acceptance commit, when the worktree already holds main's file; a
 * refused acceptance asks for nothing.
 */

const PLAN = "seat-holds";
const briefPath = ".indusk/planning/seat-holds/brief.md";
const asks: Array<{ plan: string; accepted: boolean; sawMainFile: boolean }> = [];
let wt = "";

vi.mock("./ask-admin.js", () => ({
	askAdminToPlan: async (_cwd: string, plan: string) => {
		const brief = git(wt, ["show", `HEAD:${briefPath}`]);
		asks.push({
			plan,
			accepted: /^status: accepted/m.test(brief),
			sawMainFile: existsSync(join(wt, "docs", "from-main.md")),
		});
		return "asked";
	},
}));

import { plansAcceptBrief } from "../../bin/commands/plans.js";

let p: PlanLifecycleProject;
let previous: string | undefined;
beforeEach(() => {
	asks.length = 0;
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	p = planLifecycleProject("accept-brief-verb");
	wt = p.makeWorktree(PLAN);
	p.commit(
		wt,
		{ [briefPath]: briefText(PLAN).replace("status: accepted", "status: draft") },
		"the brief",
	);
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	vi.restoreAllMocks();
	p.cleanup();
});

describe("the planning run is asked for after an accepted brief", () => {
	it("A21: a branch behind main asks once, after the acceptance commit, with main's file already there", async () => {
		p.commit(p.trunk, { "docs/from-main.md": "main\n" }, "main moves");
		vi.spyOn(console, "info").mockImplementation(() => {});
		await plansAcceptBrief(p.trunk, PLAN);
		expect(asks).toEqual([{ plan: PLAN, accepted: true, sawMainFile: true }]);
	});

	it("A22: a conflicting acceptance asks for nothing and exits through its refusal", async () => {
		p.commit(p.trunk, { "docs/notes.md": "a\nb\nc\n" }, "notes");
		git(wt, ["merge", "-q", "main"]);
		p.commit(wt, { "docs/notes.md": "a\nmine\nc\n" }, "mine");
		p.commit(p.trunk, { "docs/notes.md": "a\ntheirs\nc\n" }, "theirs");
		vi.spyOn(console, "info").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const exit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});
		await expect(plansAcceptBrief(p.trunk, PLAN)).rejects.toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error.mock.calls.flat().join("\n")).toContain("docs/notes.md");
		expect(asks).toEqual([]);
		expect(readFileSync(join(wt, briefPath), "utf-8")).toContain("status: draft");
	});
});
