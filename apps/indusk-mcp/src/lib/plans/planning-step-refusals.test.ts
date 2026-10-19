import { cpSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { briefText, implText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { approve } from "../looks/approve.js";
import { approvePlan } from "./approve.js";

/**
 * a-brief-is-planned-unasked T6 — clause:
 * an-accepted-brief-is-planned-unasked/never-approves.
 * promise: an-accepted-brief-is-planned-unasked
 *
 * A planning step's session may run any shell command, so approving a plan and
 * approving a look refuse inside one, naming the step. Starting a build is the
 * admin's function and is tested with the admin (T2). Starts git, so it runs
 * in the system tier.
 */

const FIXTURE = join(__dirname, "..", "..", "__tests__", "fixtures", "looks-app");
const STEPS = ["plan-test-plan", "plan-adr", "plan-impl"];

const PLAN = "seat-holds";

let p: PlanLifecycleProject;
let wt: string;
let looks: string;
let previous: string | undefined;
beforeEach(() => {
	previous = process.env[BUILD_STEP_ENV];
	p = planLifecycleProject("planning-step-refusals");
	wt = p.makeWorktree(PLAN);
	const dir = `.indusk/planning/${PLAN}`;
	p.commit(
		wt,
		{
			[`${dir}/brief.md`]: briefText(PLAN),
			[`${dir}/impl.md`]: implText(PLAN, { status: "draft", rows: [{ state: "planned" }] }),
		},
		"plan documents",
	);
	// Looks live in a second checkout, unrecorded as a plan: the plan's own branch holds plan documents only.
	looks = join(p.base, "looks-checkout");
	git(p.trunk, ["worktree", "add", "-q", looks, "-b", "looks-checkout", "main"]);
	cpSync(FIXTURE, looks, { recursive: true });
	git(looks, ["add", "-A"]);
	git(looks, ["commit", "-q", "-m", "the looks fixture"]);
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	p.cleanup();
});

/** What a call refused with, whether it threw or reported a reason. */
async function refusal(run: () => Promise<unknown>): Promise<string> {
	try {
		const result = (await run()) as { approved?: boolean; reason?: string } | undefined;
		return result && result.approved === false ? (result.reason ?? "") : "(not refused)";
	} catch (err) {
		return (err as Error).message;
	}
}

describe("a planning step approves nothing", () => {
	for (const step of STEPS) {
		it(`T6: approving a plan is refused inside ${step}, naming it`, async () => {
			process.env[BUILD_STEP_ENV] = step;
			expect(await refusal(() => approvePlan(p.trunk, PLAN))).toContain(step);
		});

		it(`T6: approving a look is refused inside ${step}, naming it`, async () => {
			process.env[BUILD_STEP_ENV] = step;
			expect(await refusal(() => approve(looks, "demo", "home.full", "sandy"))).toContain(step);
		});
	}
});
