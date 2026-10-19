// promise: approval-waits-for-a-finished-plan
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PLAN_REVIEW_QUESTIONS } from "../audit/answers.js";
import { readPlanReview } from "./plan-review.js";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "plan-review-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const review = (answered: boolean) =>
	[
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
