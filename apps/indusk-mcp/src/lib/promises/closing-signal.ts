import type { Tracer } from "@opentelemetry/api";
import { commandTracer, flushCommandTracer } from "../telemetry/command-tracer.js";
import { markProjectId } from "./config.js";
import type { ConfirmResult } from "./confirm.js";
import { markPromise } from "./mark.js";

/**
 * The signal a real close writes for the clauses it keeps (mark-first ADR D1):
 * `verified-before-release` and `upheld-by-its-signal` of
 * `a-clause-is-proved-twice`, through the commands' one tracer, so the daemon
 * hears them from a run of the real system and closing's own promise can be
 * read like any other. Derived from the clause, not from a test: the close is
 * broken when it accepted a plan although a half it judged refused a clause,
 * upheld when its verdict followed what it judged. Nothing is written for a
 * half that judged no clause; a run under a test runner is marked as one by
 * `markPromise`, and no reader counts it.
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/verified-before-release
 * clause: a-clause-is-proved-twice/upheld-by-its-signal
 */

const PROMISE = "a-clause-is-proved-twice";
const SIGNAL = { plan: "mark-first", phase: "Build Phase 4" };

export async function markClosing(
	projectRoot: string,
	plan: string,
	result: ConfirmResult,
	tracer?: Tracer,
): Promise<void> {
	const halves = result.halves;
	if (!halves) return;
	try {
		const project = markProjectId(projectRoot);
		for (const [clause, half] of [
			["verified-before-release", halves.tests],
			["upheld-by-its-signal", halves.signal],
		] as const) {
			if (half.checked.length === 0) continue;
			// One span per clause: a span names one clause (`indusk.clause`).
			const span = (tracer ?? commandTracer()).startSpan("promises.confirm");
			span.setAttribute("indusk.plan", plan);
			const broken = result.ok && half.refused.length > 0;
			markPromise(span, {
				promise: PROMISE,
				clause,
				project,
				outcome: broken ? "broken" : "upheld",
				signal: SIGNAL,
				...(broken
					? { symptom: `${plan} closed although ${half.refused.join(", ")} was refused` }
					: {}),
			});
			span.end();
		}
	} catch {
		// A signal is best-effort: writing it must never fail the close.
	}
	if (!tracer) await flushCommandTracer();
}
