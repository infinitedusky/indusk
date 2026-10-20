import type { Tracer } from "@opentelemetry/api";
import { markProjectId } from "../promises/config.js";
import { markPromise } from "../promises/mark.js";
import { commandTracer, flushCommandTracer } from "../telemetry/command-tracer.js";

/**
 * Where this plan's clauses are reported (decisions-as-questions, Build Phase 7): each
 * place that decides one of them writes a signal through the commands' one tracer, in
 * the shape the close reads (`markClosing` is the model). Best-effort — a collector
 * that is down, or a tracer that throws, never fails what reported — and a run under a
 * test runner is marked as one by `markPromise`, which no reader counts.
 *
 *   asked-with-a-recommendation  build/decision-request.ts (a question asked complete, or
 *                                sent back before the person saw it)
 *   never-decided-silently       questions/silent.ts (a step's saved documents, read after it)
 *   holds-by-default             build/decision-request.ts (a question left to wait, no setting)
 *   the-setting-decides          questions/sweep.ts (a due question sent ahead)
 *   a-hold-frees-the-slot        admin build-host (a stopped run's place, counted after)
 *   never-timed-out              build/decision-request.ts (a question that changes what was agreed, held)
 *   disagreement-opens-a-plan    questions/answer.ts (a late differing answer)
 *   every-decision-stays         questions/history.ts (a question read back after it is written)
 *   release-refuses              bin/commands/release.ts (a release with a follow-on open)
 *   landing-never-waits          bin/commands/plans.ts (a landing with a follow-on open)
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 * clause: a-decision-is-a-question/never-decided-silently
 * clause: the-cost-sets-the-wait/holds-by-default
 * clause: the-cost-sets-the-wait/the-setting-decides
 * clause: the-cost-sets-the-wait/a-hold-frees-the-slot
 * clause: what-was-agreed-is-never-cheap/never-timed-out
 * clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan
 * clause: a-late-answer-opens-a-follow-on/every-decision-stays
 * clause: a-release-waits-for-a-known-wrong/release-refuses
 * clause: a-release-waits-for-a-known-wrong/landing-never-waits
 */
export const CLAUSES = {
	"asked-with-a-recommendation": "a-decision-is-a-question",
	"never-decided-silently": "a-decision-is-a-question",
	"holds-by-default": "the-cost-sets-the-wait",
	"the-setting-decides": "the-cost-sets-the-wait",
	"a-hold-frees-the-slot": "the-cost-sets-the-wait",
	"never-timed-out": "what-was-agreed-is-never-cheap",
	"disagreement-opens-a-plan": "a-late-answer-opens-a-follow-on",
	"every-decision-stays": "a-late-answer-opens-a-follow-on",
	"release-refuses": "a-release-waits-for-a-known-wrong",
	"landing-never-waits": "a-release-waits-for-a-known-wrong",
} as const;

export type QuestionClause = keyof typeof CLAUSES;

const SIGNAL = { plan: "decisions-as-questions", phase: "Build Phase 7" };

export async function reportClause(
	projectRoot: string,
	clause: QuestionClause,
	verdict: { outcome: "upheld" } | { outcome: "broken"; symptom: string },
	tracer?: Tracer,
): Promise<void> {
	try {
		const span = (tracer ?? commandTracer()).startSpan(`questions.${clause}`);
		markPromise(span, {
			promise: CLAUSES[clause],
			clause,
			project: markProjectId(projectRoot),
			outcome: verdict.outcome,
			signal: SIGNAL,
			...(verdict.outcome === "broken" ? { symptom: verdict.symptom } : {}),
		});
		span.end();
	} catch {
		// A signal is best-effort: writing it must never fail what reported it.
	}
	if (!tracer) await flushCommandTracer();
}
