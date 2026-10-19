import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type AuditAnswers,
	isAnswered,
	PLAN_REVIEW_QUESTIONS,
	readAuditAnswers,
} from "../audit/answers.js";

/**
 * A plan's `plan-review.md` read the one way (approval-waits-for-the-planning-run):
 * missing, written with a finding still unanswered, or answered. The planning run's
 * stop and the admin's offer of approval both ask this, so the run cannot stop
 * "ready for approval" on a review the offer reads as unanswered.
 *
 * promise: approval-waits-for-a-finished-plan
 */

export type PlanReviewState = "missing" | "unanswered" | "answered";

/** plan-review.md read through the one reader, with the plan review's questions. */
export function planReviewAnswers(text: string): AuditAnswers {
	return readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS, causes: false });
}

/** `null` is a file that is not there. */
export function planReviewState(text: string | null): PlanReviewState {
	if (text === null) return "missing";
	return isAnswered(planReviewAnswers(text)) ? "answered" : "unanswered";
}

export function readPlanReview(planDir: string): PlanReviewState {
	const path = join(planDir, "plan-review.md");
	return planReviewState(existsSync(path) ? readFileSync(path, "utf-8") : null);
}
