import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptPlan } from "../lib/plans/accept.js";
import { amendmentsOf } from "../lib/plans/amendments.js";
import { landPlan } from "../lib/plans/land.js";
import { readsFor } from "../lib/plans/plan-tests.js";
import { reapprovePlan } from "../lib/plans/reapprove.js";
import {
	type BriefAppProject,
	briefAppProject,
	implOf,
	PLAN,
	PLAN_DIR,
} from "./helpers/brief-app.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { briefText } from "./helpers/plan-fixture.js";
import { DOMAIN } from "./helpers/plan-lifecycle-fixture.js";
import { approveWithReview } from "./helpers/plan-review-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * clause: a-plan-is-found-in-the-archive/one-lookup  (T3, T4, T5)
 * clause: a-plan-is-found-in-the-archive/the-brief-at-approval  (T7)
 * promise: a-plan-is-found-in-the-archive
 *
 * The retrospective archives a plan on its own branch before it lands. These
 * tests approve a plan, move its folder to `archive/` on that branch, commit,
 * and ask the commands that act on a plan to find it where it lies. System
 * tier: it starts git and the built CLI (`plans approve`).
 */

const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const ARCHIVED = `.indusk/planning/archive/${PLAN}`;

const brief = (sentence = SENTENCE) =>
	briefText(PLAN, {
		expectations: [
			{ text: "People seat themselves", measure: "seats taken per day", look: "in two weeks" },
		],
		makes: [{ name: NAME, sentence }],
	});

let app: BriefAppProject;
let savedStep: string | undefined;
beforeEach(() => {
	// accept and land refuse inside a build step; the tests run in one.
	savedStep = process.env.INDUSK_BUILD_STEP;
	delete process.env.INDUSK_BUILD_STEP;
	app = briefAppProject("archived-plan-found");
	writePromiseWith(SENTENCE);
	app.writePlan({ brief: brief(), impl: implOf("internal") });
	const approved = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));
	expect(approved.code, `${approved.stdout}\n${approved.stderr}`).toBe(0);
	// What the retrospective does on the plan's branch before landing.
	mkdirSync(join(app.wt, ".indusk", "planning", "archive"), { recursive: true });
	git(app.wt, ["mv", PLAN_DIR, ARCHIVED]);
	git(app.wt, ["add", "-A"]);
	git(app.wt, ["commit", "-q", "-m", `plan(${PLAN}): archived`]);
});
afterEach(() => {
	if (savedStep !== undefined) process.env.INDUSK_BUILD_STEP = savedStep;
	app.cleanup();
});

function writePromiseWith(statement: string): void {
	writePromise(join(app.wt, ".indusk", "promises"), {
		name: NAME,
		kind: "state",
		state: "declared",
		domain: DOMAIN,
		owner: PLAN,
		statement,
	});
}

describe.skipIf(SHOULD_SKIP)("a plan archived on its branch is found", () => {
	it("T3 it can be accepted, and the acceptance is recorded on its impl", async () => {
		await acceptPlan(app.trunk, PLAN);
		const impl = matter(readFileSync(join(app.wt, ARCHIVED, "impl.md"), "utf-8"));
		expect(impl.data.accepted).toBeTruthy();
	});

	it("T4 an accepted plan that has been archived lands", async () => {
		// Written by hand, not through `acceptPlan`: T3 owns accepting, and this
		// row asks only that landing finds the acceptance where the plan lies.
		const implFile = join(app.wt, ARCHIVED, "impl.md");
		const text = readFileSync(implFile, "utf-8");
		writeFileSync(
			implFile,
			text.replace(/^---\n/, `---\naccepted: "2026-10-18T00:00:00.000Z"\naccepted_by: person\n`),
		);
		git(app.wt, ["add", "-A"]);
		git(app.wt, ["commit", "-q", "-m", `plan(${PLAN}): accepted`]);
		const landed = await landPlan(app.trunk, PLAN);
		expect(landed.plan).toBe(PLAN);
		expect(git(app.trunk, ["ls-tree", "-r", "--name-only", "main"])).toContain(
			`${ARCHIVED}/impl.md`,
		);
	});

	it("T5 the tests a plan runs at landing are listed for it", () => {
		const reads = readsFor(app.wt, PLAN);
		expect(reads.rows.map((r) => r.id)).toEqual(["T1"]);
	});

	it("T7 the amendments of a plan archived after approval are listed against the approved brief, and can be re-approved", async () => {
		const now = "A held seat is released at once when its hold runs out.";
		writePromiseWith(now);
		writeFileSync(join(app.wt, ARCHIVED, "brief.md"), brief(now));
		const waiting = await amendmentsOf(join(app.wt, ARCHIVED));
		expect(waiting.map((a) => a.part)).toContain("promise");
		const reapproved = await reapprovePlan(app.trunk, PLAN);
		expect(reapproved.amendments.length).toBeGreaterThan(0);
	});
});
