import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { recordPhaseStart } from "./boundary.js";
import { prepareShapeReview, recordLeftAsIs, recordReviewedNothingFound } from "./shape.js";
import { commitAll, git, implWithPhase, makeRepo, writeFixtureFile } from "./shape.test-support.js";

/**
 * A4, A6, A7, A10 — the review surface, and the three outcomes it must be able
 * to tell apart.
 *
 * The governing rule, learned expensively in `dawn-verify`: a check that cannot
 * distinguish "nothing to do" from "did not run" reports the shape of success
 * without doing the work. So "reviewed and found nothing" and "skipped, no code
 * surface" are both RECORDED outcomes, never silence.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

async function repoAtPhase(phase: number): Promise<string> {
	const root = await makeRepo();
	await recordPhaseStart(root, {
		plan: "demo",
		phase,
		sha: await git(root, "rev-parse", "HEAD"),
		at: "2026-08-08T00:00:00.000Z",
	});
	return root;
}

const GREEN = implWithPhase({
	phase: 1,
	items: [[true, "build the thing"]],
	verification: [[true, "tests pass"]],
});

describe("A10 — Shape does not review code whose correctness is unproven", () => {
	it("declines when the phase's verification is not green, naming that reason", async () => {
		const root = await repoAtPhase(1);
		roots.push(root);
		await writeFixtureFile(root, "src/thing.ts", "export const x = 1;\n");

		const red = implWithPhase({
			phase: 1,
			items: [[true, "build the thing"]],
			verification: [[false, "tests pass"]],
		});

		const outcome = await prepareShapeReview({ root, plan: "demo", phase: 1, implBody: red });

		expect(outcome.kind).toBe("skipped");
		if (outcome.kind === "skipped") expect(outcome.reason).toMatch(/verification/i);
		// 30s, not vitest's 5s default — real repo, real git. See changed.test.ts.
	}, 30_000);

	it("proceeds once verification is green", async () => {
		const root = await repoAtPhase(1);
		roots.push(root);
		await writeFixtureFile(root, "src/thing.ts", "export const x = 1;\n");

		const outcome = await prepareShapeReview({ root, plan: "demo", phase: 1, implBody: GREEN });

		expect(outcome.kind).toBe("review");
	}, 30_000);
});

describe("A6 — a phase with no code surface is skipped, not silently passed", () => {
	it("records the reason when the phase changed no code files", async () => {
		const root = await repoAtPhase(1);
		roots.push(root);
		// Only plan/machine state moved — no code.
		await writeFixtureFile(root, ".indusk/planning/demo/impl.md", "# plan\n");
		await commitAll(root, "docs only");

		const outcome = await prepareShapeReview({ root, plan: "demo", phase: 1, implBody: GREEN });

		expect(outcome.kind).toBe("skipped");
		if (outcome.kind === "skipped") expect(outcome.reason).toMatch(/no code/i);
	}, 30_000);
});

describe("A4 — well-shaped code adds no items and says the review ran", () => {
	it("records that the review happened and found nothing", () => {
		const out = recordReviewedNothingFound(GREEN, 1);

		expect(out).toMatch(/shape/i);
		expect(out).toMatch(/nothing/i);
	});

	it("adds the note already checked, so it never blocks the phase", () => {
		// "Nothing to do" has to be a cheap, common outcome — otherwise Shape is
		// a nag and gets ignored, which is worse than not running it.
		const out = recordReviewedNothingFound(GREEN, 1);
		const note = out.split("\n").find((l) => /shape/i.test(l) && /nothing/i.test(l));

		expect(note?.trimStart().startsWith("- [x]")).toBe(true);
	});
});

describe("A7 — a deliberate leave-as-is is recorded with its reason", () => {
	it("names the file and why it was left alone", () => {
		const out = recordLeftAsIs(
			GREEN,
			1,
			"src/thing.ts",
			"one cohesive unit; splitting would scatter tightly-coupled logic",
		);

		expect(out).toContain("src/thing.ts");
		expect(out).toContain("cohesive");
	});

	it("is distinguishable from a file that was never reviewed", () => {
		const reviewed = recordLeftAsIs(GREEN, 1, "src/thing.ts", "cohesive as written");

		// The record must say a review happened — absence of a finding is not
		// evidence of a review.
		expect(reviewed).toMatch(/reviewed/i);
	});
});
