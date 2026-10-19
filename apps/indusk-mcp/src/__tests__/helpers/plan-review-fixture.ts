import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_REVIEW_QUESTIONS } from "../../lib/audit/answers.js";
import { planDocumentsHash } from "../../lib/plans/plan-review.js";
import { runCli } from "./cli.js";

/**
 * A plan review in the shape the one reader reads (`plans/plan-review`): every question put,
 * nothing found, and `read:` the hash it was written for.
 */
export function answeredPlanReview(read: string): string {
	return [
		"---",
		`read: ${read}`,
		"---",
		"",
		"# Plan review",
		"",
		...PLAN_REVIEW_QUESTIONS.flatMap((q) => [`## ${q}`, "", "- Nothing.", ""]),
	].join("\n");
}

/**
 * Write an answered `plan-review.md` for the plan folder's documents as they stand, as the
 * cold read does before approval (a-run-can-be-trusted, Decision 11: `plans approve` refuses
 * a plan without one). Write it after the plan's documents, since it goes stale with them.
 */
export function writeCurrentPlanReview(planDir: string): void {
	writeFileSync(join(planDir, "plan-review.md"), answeredPlanReview(planDocumentsHash(planDir)));
}

/** `indusk plans approve <plan>` after the plan's review is written for its documents now. */
export function approveWithReview(cwd: string, plan: string, planDir: string) {
	writeCurrentPlanReview(planDir);
	return runCli(cwd, ["plans", "approve", plan]);
}
