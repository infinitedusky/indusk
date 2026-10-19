// clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { acceptBrief } from "./accept-brief.js";

/**
 * a-brief-is-planned-unasked T1 — clause:
 * an-accepted-brief-is-planned-unasked/starts-on-acceptance.
 * promise: an-accepted-brief-is-planned-unasked
 *
 * Accepting a brief is a command, not a hand edit: it sets the status when the
 * plan's contract check passes and refuses, naming the problem, when it does
 * not. Starts git, so it runs in the system tier.
 */

const PLAN = "seat-holds";
const draft = (text: string) => text.replace("status: accepted", "status: draft");

let p: PlanLifecycleProject;
let wt: string;
let previous: string | undefined;
beforeEach(() => {
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	p = planLifecycleProject("accept-brief");
	wt = p.makeWorktree(PLAN);
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	p.cleanup();
});

const briefIn = () => join(wt, ".indusk", "planning", PLAN, "brief.md");
const write = (text: string) =>
	p.commit(wt, { [`.indusk/planning/${PLAN}/brief.md`]: text }, "the brief");

describe("accepting a brief", () => {
	it("T1: a brief whose contract passes is marked accepted and committed on the plan's branch", async () => {
		write(draft(briefText(PLAN)));
		await acceptBrief(p.trunk, PLAN);
		expect(readFileSync(briefIn(), "utf-8")).toContain("status: accepted");
		expect(git(wt, ["log", "-1", "--format=%s"])).toContain(PLAN);
		expect(git(wt, ["status", "--porcelain"])).toBe("");
	});

	it("T1: a brief whose contract fails is refused, naming the problem, and stays a draft", async () => {
		write(draft(briefText(PLAN, { mustNotBreak: ["no-such-promise"] })));
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow(/no-such-promise/);
		expect(readFileSync(briefIn(), "utf-8")).toContain("status: draft");
	});

	it("T1: a brief that is not a draft is refused", async () => {
		write(briefText(PLAN));
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow(/draft/);
	});

	it("T1: accepting is refused inside a build step, naming it", async () => {
		write(draft(briefText(PLAN)));
		process.env[BUILD_STEP_ENV] = "plan-impl";
		await expect(acceptBrief(p.trunk, PLAN)).rejects.toThrow(/plan-impl/);
	});
});
