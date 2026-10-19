import type { Tracer } from "@opentelemetry/api";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";
import type { AuditAnswers } from "./answers.js";

/**
 * The signal reading an audit's answers writes (audit-concerns-are-answered, Build Phase 7):
 * one span for each clause of `an-audit-concern-gets-a-solution` the read can judge,
 * through the commands' one tracer. Upheld when the read found that part complete, broken
 * naming the finding when not. A plan review is a different read and reports through
 * `review-signal.ts`.
 *
 * promise: an-audit-concern-gets-a-solution
 * clause: an-audit-concern-gets-a-solution/the-audit-finds
 * clause: an-audit-concern-gets-a-solution/the-plan-answers
 * clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person
 * clause: an-audit-concern-gets-a-solution/an-audit-teaches
 */

const PROMISE = "an-audit-concern-gets-a-solution";
const SIGNAL = { plan: "audit-concerns-are-answered", phase: "Build Phase 7" };

export async function markAuditAnswers(
	projectRoot: string,
	plan: string,
	read: AuditAnswers,
	/** Whether the dismissals were printed for the person (false when the command stopped on an open finding). */
	printed: boolean,
	tracer?: Tracer,
): Promise<void> {
	const verdict = (clause: string, seen: string | undefined): ClauseVerdict => ({
		promise: PROMISE,
		clause,
		...(seen === undefined ? {} : { broken: `${plan}: ${seen}`.slice(0, 500) }),
	});
	const verdicts = [
		verdict("the-audit-finds", read.incomplete[0]?.finding),
		verdict("the-plan-answers", (read.unanswered[0] ?? read.noClause[0])?.finding),
		verdict(
			"a-dismissal-reaches-the-person",
			!printed && read.dismissals.length > 0
				? `${read.dismissals.length} dismissal(s) not shown to the person`
				: undefined,
		),
		verdict("an-audit-teaches", read.missingCauses ? "findings and no causes section" : undefined),
	];
	await writeClauseSignals(projectRoot, "plans.audit-answers", plan, SIGNAL, verdicts, tracer);
}
