// promise: approval-waits-for-a-finished-plan
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PLAN_REVIEW_QUESTIONS } from "../audit/answers.js";
import { planReviewHash } from "../audit/review-hash.js";
import { planReviewState, readPlanReview } from "./plan-review.js";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "plan-review-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** The hash of an empty plan folder's documents: the read a review of this folder records. */
const EMPTY = planReviewHash({ brief: null, testPlan: null, adr: null, impl: null });

const review = (answered: boolean, read: string | null = EMPTY) =>
	[
		...(read === null ? [] : ["---", `read: ${read}`, "---", ""]),
		"# Plan review",
		"",
		...PLAN_REVIEW_QUESTIONS.flatMap((q, i) => [
			`## ${q}`,
			"",
			i === 0
				? [
						"- a finding",
						"  - breaks when: a run stops early",
						...(answered ? ["  - answer: fix — the rule reads the file"] : []),
					].join("\n")
				: "- Nothing.",
			"",
		]),
	].join("\n");

it("A9 reads a missing plan review as missing", () => {
	expect(readPlanReview(dir)).toBe("missing");
});

it("A9 reads a plan review with an unanswered finding as unanswered", () => {
	writeFileSync(join(dir, "plan-review.md"), review(false));
	expect(readPlanReview(dir)).toBe("unanswered");
});

it("A9 reads a plan review with every question's section and every finding answered as answered", () => {
	writeFileSync(join(dir, "plan-review.md"), review(true));
	expect(readPlanReview(dir)).toBe("answered");
});

// a-run-can-be-trusted, Decision 11: the one reader compares the review's `read:` hash with
// the documents as they stand.
it("reads an answered plan review written for other documents as stale", () => {
	writeFileSync(join(dir, "plan-review.md"), review(true, "f".repeat(64)));
	expect(readPlanReview(dir)).toBe("stale");
});

it("reads an answered plan review that records no read hash as stale", () => {
	writeFileSync(join(dir, "plan-review.md"), review(true, null));
	expect(readPlanReview(dir)).toBe("stale");
});

it("reads a review stale once a document it was written for changes", () => {
	writeFileSync(join(dir, "plan-review.md"), review(true));
	expect(readPlanReview(dir)).toBe("answered");
	writeFileSync(join(dir, "impl.md"), "---\nstatus: draft\n---\n# Impl\n");
	expect(readPlanReview(dir)).toBe("stale");
});

it("reads stale before unanswered, and an unreadable frontmatter as no read", () => {
	expect(planReviewState(review(false, "f".repeat(64)), EMPTY)).toBe("stale");
	expect(planReviewState("---\nread: [unclosed\n---\n# Plan review\n", EMPTY)).toBe("stale");
});
