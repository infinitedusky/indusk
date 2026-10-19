import type { Tracer } from "@opentelemetry/api";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";
import type { AuditAnswers } from "./answers.js";
import type { PlanReviewInputs } from "./inputs.js";

/**
 * The signals the plan review writes (audit-concerns-are-answered, Build Phase 7), one
 * clause each of `a-plan-is-read-cold-before-approval`, through the commands' one tracer:
 * the inputs it prints (documents only), the read of its answers (four questions), and the
 * planning run's stop at approval (read cold, answered).
 *
 * promise: a-plan-is-read-cold-before-approval
 * clause: a-plan-is-read-cold-before-approval/the-reader-sees-documents-only
 * clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan
 * clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval
 * clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold
 */

const PROMISE = "a-plan-is-read-cold-before-approval";
const SIGNAL = { plan: "audit-concerns-are-answered", phase: "Build Phase 7" };

const INPUT_KEYS = ["documents", "plan", "tree"];
const DOCUMENT_KEYS = ["adr", "brief", "impl", "testPlan"];

const verdict = (clause: string, seen: string | undefined): ClauseVerdict => ({
	promise: PROMISE,
	clause,
	...(seen === undefined ? {} : { broken: seen.slice(0, 500) }),
});

/** The keys of `value` that are not in `allowed`, or `allowed` keys missing, as one phrase; undefined when exact. */
function keyFault(label: string, value: object, allowed: string[]): string | undefined {
	const keys = Object.keys(value).sort();
	const extra = keys.filter((k) => !allowed.includes(k));
	const lacking = allowed.filter((k) => !keys.includes(k));
	if (extra.length === 0 && lacking.length === 0) return undefined;
	return `${label} holds ${extra.length > 0 ? `unexpected ${extra.join(", ")}` : `no ${lacking.join(", ")}`}`;
}

export async function markReviewInputs(
	projectRoot: string,
	plan: string,
	printed: PlanReviewInputs,
	tracer?: Tracer,
): Promise<void> {
	const fault =
		keyFault("the inputs", printed, INPUT_KEYS) ??
		keyFault("the documents", printed.documents, DOCUMENT_KEYS);
	await writeClauseSignals(
		projectRoot,
		"plans.review-inputs",
		plan,
		SIGNAL,
		[verdict("the-reader-sees-documents-only", fault)],
		tracer,
	);
}

export async function markPlanReview(
	projectRoot: string,
	plan: string,
	read: AuditAnswers,
	tracer?: Tracer,
): Promise<void> {
	const missing = read.missingQuestions[0];
	await writeClauseSignals(
		projectRoot,
		"plans.audit-answers",
		plan,
		SIGNAL,
		[verdict("the-reader-checks-the-plan", missing && `no section for: ${missing}`)],
		tracer,
	);
}

/** What a planning run knew when it stopped at `ready-for-approval`. */
export interface PlanningStopFacts {
	/** A plan review ran in this run, or stood complete when the run began. */
	reviewed: boolean;
	/** The review's answers read complete at the stop. */
	reviewComplete: boolean;
}

export async function markPlanningStop(
	projectRoot: string,
	plan: string,
	facts: PlanningStopFacts,
	tracer?: Tracer,
): Promise<void> {
	await writeClauseSignals(
		projectRoot,
		"planning.ready-for-approval",
		plan,
		SIGNAL,
		[
			verdict(
				"the-plan-is-answered-before-approval",
				facts.reviewComplete
					? undefined
					: `${plan} reached approval with its plan review incomplete`,
			),
			verdict(
				"the-planning-run-reads-it-cold",
				facts.reviewed ? undefined : `${plan} reached approval and no plan review ran`,
			),
		],
		tracer,
	);
}
