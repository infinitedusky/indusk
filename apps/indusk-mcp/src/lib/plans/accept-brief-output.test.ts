// clause: a-brief-is-accepted-on-current-main/the-person-never-merges
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { withEnv } from "../../__tests__/helpers/with-env.js";
import { plansAcceptBrief } from "../../bin/commands/plans.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1 (A17): a branch behind
 * main with no conflict is accepted in one command that asks nothing — it
 * prints no instruction to merge, update or pull, reads no input and does not
 * exit non-zero.
 */

const PLAN = "seat-holds";
const briefPath = ".indusk/planning/seat-holds/brief.md";

let p: PlanLifecycleProject;
let wt: string;
let home: string;
let previous: string | undefined;
beforeEach(() => {
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	home = mkdtempSync(join(tmpdir(), "accept-brief-output-home-"));
	p = planLifecycleProject("accept-brief-output");
	wt = p.makeWorktree(PLAN);
	p.commit(
		wt,
		{ [briefPath]: briefText(PLAN).replace("status: accepted", "status: draft") },
		"the brief",
	);
	p.commit(p.trunk, { "docs/from-main.md": "main\n" }, "main moves");
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	vi.restoreAllMocks();
	p.cleanup();
	rmSync(home, { recursive: true, force: true });
});

describe("accepting on a branch behind main asks nothing", () => {
	it("A17: one command accepts it, prints no instruction to merge, and reads no input", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const exit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit was called");
		});
		const stdin = vi.spyOn(process.stdin, "on");
		await withEnv({ HOME: home }, () => plansAcceptBrief(p.trunk, PLAN));
		expect(exit).not.toHaveBeenCalled();
		expect(stdin).not.toHaveBeenCalled();
		const printed = [...info.mock.calls, ...error.mock.calls].flat().join("\n");
		expect(printed).not.toMatch(/\b(merge|rebase|pull)\b/i);
		expect(printed).not.toMatch(/update (the|your) branch/i);
		expect(existsSync(join(wt, "docs", "from-main.md"))).toBe(true);
	});
});
