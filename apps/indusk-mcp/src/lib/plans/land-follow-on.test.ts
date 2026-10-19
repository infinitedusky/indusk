// clause: a-release-waits-for-a-known-wrong/landing-never-waits
import { mkdtempSync, rmSync } from "node:fs";
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
 * decisions-as-questions T16, a regression guard: landing never waits for a
 * follow-on. A draft follow-on plan (`follow_on_of` in its brief) sits in the
 * planning folder on the trunk; an accepted plan lands anyway, and so does the
 * follow-on itself while it is open. Only `indusk release` reads the marker.
 */

const PLAN = "seat-holds";
const FOLLOW = "seat-holds-q-1";
let p: PlanLifecycleProject;
let home: string;
const previousHome = process.env.INDUSK_HOME;
// `plans accept` refuses inside a build step; the test plays the person accepting.
const previousStep = process.env.INDUSK_BUILD_STEP;

beforeEach(() => {
	delete process.env.INDUSK_BUILD_STEP;
	home = mkdtempSync(join(tmpdir(), "land-follow-home-"));
	process.env.INDUSK_HOME = home;
	p = planLifecycleProject("land-follow-on");
	p.commit(
		p.trunk,
		{
			[`.indusk/planning/${FOLLOW}/brief.md`]: `---\ntitle: "Follow-on"\nstatus: draft\nfollow_on_of: ${PLAN}/q-1\n---\n\n# Follow-on\n`,
		},
		"an open follow-on",
	);
});
afterEach(() => {
	p.cleanup();
	if (previousStep !== undefined) process.env.INDUSK_BUILD_STEP = previousStep;
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	rmSync(home, { recursive: true, force: true });
});

const build = (plan: string) => {
	const wt = p.makeWorktree(plan);
	p.commit(
		wt,
		{
			[`.indusk/planning/${plan}/impl.md`]: implText(plan, {
				status: "completed",
				rows: [{ state: "passing" }],
			}),
			[`src/${plan}.ts`]: "export const seat = 1;\n",
		},
		"the build",
	);
	expect(runCli(p.trunk, ["plans", "accept", plan]).code).toBe(0);
	return wt;
};

describe.skipIf(SHOULD_SKIP)("T16 — landing ignores an open follow-on", () => {
	it("an accepted plan lands with a follow-on open", async () => {
		build(PLAN);
		const before = p.mainSha();
		await landPlan(p.trunk, PLAN, {
			runningFrom: join(p.trunk, "apps", "indusk-mcp", "dist", "bin", "cli.js"),
		});
		expect(p.mainSha()).not.toBe(before);
	});

	it("the follow-on itself lands while it is open", async () => {
		build(FOLLOW);
		const before = p.mainSha();
		await landPlan(p.trunk, FOLLOW, {
			runningFrom: join(p.trunk, "apps", "indusk-mcp", "dist", "bin", "cli.js"),
		});
		expect(p.mainSha()).not.toBe(before);
	});
});
