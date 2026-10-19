import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import {
	type AuditAnswers,
	isAnswered,
	PLAN_REVIEW_QUESTIONS,
	readAuditAnswers,
} from "../audit/answers.js";
import { planReviewHash } from "../audit/review-hash.js";

/**
 * A plan's `plan-review.md` read the one way (approval-waits-for-a-finished-plan):
 * missing, written for other documents than stand now (stale), written with a finding
 * still unanswered, or answered. The planning run's stop, the admin's offer of approval,
 * the plan page's Planning audit step and `plans approve` all ask this, so none of them
 * can read a plan as ready while another reads it as needing its review
 * (a-run-can-be-trusted, Decision 11).
 *
 * promise: approval-waits-for-a-finished-plan
 */

export type PlanReviewState = "missing" | "stale" | "unanswered" | "answered";

/** plan-review.md read through the one reader, with the plan review's questions. */
export function planReviewAnswers(text: string): AuditAnswers {
	return readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS, causes: false });
}

/**
 * The `read:` hash a plan review records: the documents it was written for. Null when it
 * records none, or its frontmatter cannot be read — either way it is not a read of the
 * documents as they stand.
 */
export function planReviewRead(text: string): string | null {
	try {
		const read = matter(text).data.read;
		return typeof read === "string" && read.trim() !== "" ? read.trim() : null;
	} catch {
		return null;
	}
}

/**
 * `null` text is a file that is not there. `documentsHash` is `planReviewHash` of the
 * plan's four documents now; a review recording another hash, or none, is stale, whatever
 * its answers say: it was not a read of the plan as it stands.
 */
export function planReviewState(text: string | null, documentsHash: string): PlanReviewState {
	if (text === null) return "missing";
	if (planReviewRead(text) !== documentsHash) return "stale";
	return planReviewAnswered(text) ? "answered" : "unanswered";
}

/** Every question put and every finding answered, whatever documents the review was written for. */
export function planReviewAnswered(text: string): boolean {
	return isAnswered(planReviewAnswers(text));
}

/** The hash of a plan folder's four documents as they stand; a missing one hashes as empty. */
export function planDocumentsHash(planDir: string): string {
	const text = (file: string): string | null => {
		const path = join(planDir, file);
		return existsSync(path) ? readFileSync(path, "utf-8") : null;
	};
	return planReviewHash({
		brief: text("brief.md"),
		testPlan: text("test-plan.md"),
		adr: text("adr.md"),
		impl: text("impl.md"),
	});
}

/** A plan folder's review, judged against the folder's documents as they stand. */
export function readPlanReview(planDir: string): PlanReviewState {
	const path = join(planDir, "plan-review.md");
	return planReviewState(
		existsSync(path) ? readFileSync(path, "utf-8") : null,
		planDocumentsHash(planDir),
	);
}
