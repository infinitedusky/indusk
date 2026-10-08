import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "../../__tests__/helpers/cli.js";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { landPlan } from "./land.js";

/**
 * small-fixes A21 (falsification) — promise: dusk-installs-its-own-build.
 *
 * `pnpm install:local` links the global `indusk` to the checkout it runs in.
 * Run in a plan's worktree (Build Phase 1's live check did), the global
 * `indusk` then lives inside that worktree, and `plans land` removes the
 * worktree it is running from: the retrospective's next step calls an
 * `indusk` that is gone, and the land itself runs on files being deleted.
 * It refuses first, before any merge, naming how to re-link from the trunk.
 */

const PLAN = "seat-holds";
const planDir = `.indusk/planning/${PLAN}`;

let p: PlanLifecycleProject;
let wt: string;
let home: string;
const previousHome = process.env.INDUSK_HOME;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "land-own-home-"));
	process.env.INDUSK_HOME = home;
	p = planLifecycleProject("land-own-worktree");
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
afterEach(() => {
	p.cleanup();
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	rmSync(home, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("A21 — land refuses to remove the build it runs from", () => {
	it("a CLI installed from the plan's worktree is refused before any merge, naming the re-link", async () => {
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const before = p.mainSha();
		const runningFrom = join(wt, "apps", "indusk-mcp", "dist", "bin", "cli.js");
		await expect(landPlan(p.trunk, PLAN, { runningFrom })).rejects.toThrow(/install:local/);
		expect(p.mainSha()).toBe(before);
		expect(existsSync(wt)).toBe(true);
	});

	it("a CLI installed from anywhere else lands", async () => {
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const runningFrom = join(p.trunk, "apps", "indusk-mcp", "dist", "bin", "cli.js");
		await landPlan(p.trunk, PLAN, { runningFrom });
		expect(existsSync(wt)).toBe(false);
	});
});
