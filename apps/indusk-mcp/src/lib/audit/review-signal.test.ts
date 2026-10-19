import { describe, expect, it } from "vitest";
import { captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import { PLAN_REVIEW_QUESTIONS, readAuditAnswers } from "./answers.js";
import type { PlanReviewInputs } from "./inputs.js";
import { markPlanningStop, markPlanReview, markReviewInputs } from "./review-signal.js";

// promise: a-plan-is-read-cold-before-approval
// clause: a-plan-is-read-cold-before-approval/the-reader-sees-documents-only
// clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan
// clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval
// clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold

/** A30 and A31: the plan review's inputs, its read and the planning run's stop report their clauses. */

const inputs = (): PlanReviewInputs => ({
	plan: "p",
	documents: { brief: null, testPlan: null, adr: null, impl: null },
	tree: "",
});

describe("A30 — the review's inputs report the documents-only clause", () => {
	it("is upheld when the printed keys are the documents and the file list", async () => {
		const { tracer, spans } = captureTracer();
		await markReviewInputs("/nowhere", "p", inputs(), tracer);
		expect(outcomesByClause(spans)).toEqual({ "the-reader-sees-documents-only": "upheld" });
	});

	it("is broken naming a field that is not one of them", async () => {
		const { tracer, spans } = captureTracer();
		const printed = { ...inputs(), research: { text: "the conversation" } } as PlanReviewInputs;
		await markReviewInputs("/nowhere", "p", printed, tracer);
		expect(outcomesByClause(spans)).toEqual({ "the-reader-sees-documents-only": "broken" });
		expect(String(spans[0].events[0].attrs?.["indusk.promise.symptom"])).toContain("research");
	});
});

describe("A31 — the plan review's read and the planning run's stop report their clauses", () => {
	it("reports the four-questions clause upheld, or broken for a missing question", async () => {
		const full = PLAN_REVIEW_QUESTIONS.map((q) => `## ${q}\nnothing.\n`).join("\n");
		const ok = captureTracer();
		await markPlanReview(
			"/nowhere",
			"p",
			readAuditAnswers(full, { questions: PLAN_REVIEW_QUESTIONS }),
			ok.tracer,
		);
		expect(outcomesByClause(ok.spans)).toEqual({ "the-reader-checks-the-plan": "upheld" });
		const bad = captureTracer();
		await markPlanReview(
			"/nowhere",
			"p",
			readAuditAnswers("", { questions: PLAN_REVIEW_QUESTIONS }),
			bad.tracer,
		);
		expect(outcomesByClause(bad.spans)).toEqual({ "the-reader-checks-the-plan": "broken" });
	});

	it("upholds both approval clauses when a complete plan review ran", async () => {
		const { tracer, spans } = captureTracer();
		await markPlanningStop("/nowhere", "p", { reviewed: true, reviewComplete: true }, tracer);
		expect(outcomesByClause(spans)).toEqual({
			"the-plan-is-answered-before-approval": "upheld",
			"the-planning-run-reads-it-cold": "upheld",
		});
	});

	it("breaks both when no plan review ran before approval and the review is incomplete", async () => {
		const { tracer, spans } = captureTracer();
		await markPlanningStop("/nowhere", "p", { reviewed: false, reviewComplete: false }, tracer);
		expect(outcomesByClause(spans)).toEqual({
			"the-plan-is-answered-before-approval": "broken",
			"the-planning-run-reads-it-cold": "broken",
		});
	});
});
