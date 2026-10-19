import type { Tracer } from "@opentelemetry/api";
import { commandTracer, flushCommandTracer } from "../telemetry/command-tracer.js";
import { markProjectId } from "./config.js";
import { markPromise } from "./mark.js";
import type { ShownClause } from "./status.js";

/**
 * The signal `indusk promises status` writes for
 * `a-clause-is-proved-twice/no-signal-is-not-holding` (mark-first decision
 * D-28): judged from the clauses the run shows (`shownClauses`), written
 * through the commands' tracer. Its own module, as the close's
 * (`closing-signal.ts`) and the recorder's (`incident-signal.ts`) are.
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/no-signal-is-not-holding
 */

/** What the signal of `no-signal-is-not-holding` says of one status run. */
export interface StatusVerdict {
	outcome: "upheld" | "broken";
	symptom?: string;
}

/**
 * The signal of `a-clause-is-proved-twice/no-signal-is-not-holding`, judged
 * from what `promises status` is about to show (mark-first decision D-28):
 * broken, naming each clause, when one is shown holding with no report or
 * while its watcher is blind; upheld otherwise. Null when no clause is shown —
 * a run that showed none says nothing about the rule. Pure: the rows and the
 * heartbeat are handed in.
 */
export function statusVerdict(shown: ShownClause[], heartbeatOk: boolean): StatusVerdict | null {
	if (shown.length === 0) return null;
	const wrong = shown.filter(
		(c) => c.standing === "holding" && (c.lastReport === null || !heartbeatOk),
	);
	if (wrong.length === 0) return { outcome: "upheld" };
	return {
		outcome: "broken",
		symptom: `promises status showed ${wrong.map((c) => `${c.promise}/${c.clause}`).join(", ")} holding ${
			heartbeatOk ? "with no report" : "while its watcher was blind"
		}`,
	};
}

const STATUS_PROMISE = "a-clause-is-proved-twice";
const STATUS_CLAUSE = "no-signal-is-not-holding";
const STATUS_SIGNAL = { plan: "mark-first", phase: "Build Phase 7" };

/**
 * Write the verdict as one span through the commands' tracer
 * (`commandTracer()`), with the plan and phase that added it, flushed before
 * a short-lived command exits. Best-effort: writing it never fails the command.
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/no-signal-is-not-holding
 */
export async function markStatusSignal(
	projectRoot: string,
	verdict: StatusVerdict,
	tracer?: Tracer,
): Promise<void> {
	try {
		const span = (tracer ?? commandTracer()).startSpan("promises.status");
		markPromise(span, {
			promise: STATUS_PROMISE,
			clause: STATUS_CLAUSE,
			project: markProjectId(projectRoot),
			outcome: verdict.outcome,
			signal: STATUS_SIGNAL,
			...(verdict.symptom ? { symptom: verdict.symptom } : {}),
		});
		span.end();
	} catch {
		// A signal is best-effort: writing it must never fail the command.
	}
	if (!tracer) await flushCommandTracer();
}
