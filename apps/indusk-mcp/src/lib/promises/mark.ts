import type { Span } from "@opentelemetry/api";
import { APP_RESOURCE_KEYS, APP_SIGNAL_KEYS, PROMISE_MARK, TEST_RUN_VALUE } from "./vocabulary.js";

/** The attribute value a broken verdict is written as. Readers still take the older `violated` (`readOutcome`). */
const WRITTEN_BROKEN = "broken";

/**
 * Write a signal on a span: a promise's outcome (day-monitor ADR D1; one
 * definition since admin-plan-authoring): the promise's name, `upheld` or
 * broken, the project when one service signals many projects, the clause it
 * concerns, and on a break the event carrying what was seen.
 *
 * A break names its promise and its clause on the event itself, and points to
 * the plan and phase that added the signal (`signal`), so an incident opened
 * from it can say where the signal came from. A span made under a test runner
 * is marked `indusk.run=test`: a test's span is not the clause's signal, and
 * the readers skip it (mark-first ADR D3).
 *
 * The wire word for a break is `broken`; older recording servers and
 * applications wrote `violated`, which every reader still takes. This is the
 * one place InDusk's own signals are written. `indusk promises status` reads
 * these from Jaeger like any application's own signals.
 */
export function markPromise(
	span: Pick<Span, "setAttribute" | "addEvent">,
	mark: {
		promise: string;
		outcome: "upheld" | "broken";
		project?: string;
		/** The part of the promise this signal concerns. */
		clause?: string;
		symptom?: string;
		/** The plan and phase that added this signal; written on the break only. */
		signal?: { plan: string; phase: string };
	},
): void {
	span.setAttribute(PROMISE_MARK.promise, mark.promise);
	if (mark.project) span.setAttribute(PROMISE_MARK.project, mark.project);
	if (mark.clause) span.setAttribute(PROMISE_MARK.clause, mark.clause);
	if (process.env.VITEST) span.setAttribute(APP_RESOURCE_KEYS.run, TEST_RUN_VALUE);
	span.setAttribute(PROMISE_MARK.outcome, mark.outcome === "broken" ? WRITTEN_BROKEN : "upheld");
	if (mark.outcome === "broken") {
		span.addEvent(PROMISE_MARK.violatedEvent, {
			[PROMISE_MARK.promise]: mark.promise,
			...(mark.clause ? { [PROMISE_MARK.clause]: mark.clause } : {}),
			[PROMISE_MARK.symptom]: (mark.symptom ?? "broken").slice(0, 500),
			...(mark.signal
				? {
						[APP_SIGNAL_KEYS.plan]: mark.signal.plan,
						[APP_SIGNAL_KEYS.phase]: mark.signal.phase,
					}
				: {}),
		});
	}
}
