import type { Span } from "@opentelemetry/api";
import { PROMISE_MARK } from "./vocabulary.js";

/** The attribute value a broken verdict is written as this release (see `markPromise`). */
const WRITTEN_BROKEN = "violated";

/**
 * Mark a span with a promise's outcome (day-monitor ADR D1; one definition
 * since admin-plan-authoring): the promise's name, `upheld` or broken,
 * the project when one service marks many projects, and on a break the
 * event carrying what was seen.
 *
 * The verdict is `broken` in code; the attribute value written is still
 * `violated` this release, so a recording server older than this plan keeps
 * reading it. Every reader takes either word (`readOutcome`).
 * `.indusk/planning/mark-first/` switches the written value to `broken` next
 * release; this is the one place to change. `indusk promises status` reads these from
 * Jaeger like any application's own marks.
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
	},
): void {
	span.setAttribute(PROMISE_MARK.promise, mark.promise);
	if (mark.project) span.setAttribute(PROMISE_MARK.project, mark.project);
	if (mark.clause) span.setAttribute(PROMISE_MARK.clause, mark.clause);
	span.setAttribute(PROMISE_MARK.outcome, mark.outcome === "broken" ? WRITTEN_BROKEN : "upheld");
	if (mark.outcome === "broken") {
		span.addEvent(PROMISE_MARK.violatedEvent, {
			[PROMISE_MARK.symptom]: (mark.symptom ?? "broken").slice(0, 500),
		});
	}
}
