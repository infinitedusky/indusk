import type { Span } from "@opentelemetry/api";
import { PROMISE_MARK } from "./vocabulary.js";

/**
 * Mark a span with a promise's outcome (day-monitor ADR D1; one definition
 * since admin-plan-authoring): the promise's name, `upheld` or `violated`,
 * the project when one service marks many projects, and on a violation the
 * event carrying what was seen. `indusk promises status` reads these from
 * Jaeger like any application's own marks.
 */
export function markPromise(
	span: Pick<Span, "setAttribute" | "addEvent">,
	mark: {
		promise: string;
		outcome: "upheld" | "violated";
		project?: string;
		symptom?: string;
	},
): void {
	span.setAttribute(PROMISE_MARK.promise, mark.promise);
	if (mark.project) span.setAttribute(PROMISE_MARK.project, mark.project);
	span.setAttribute(PROMISE_MARK.outcome, mark.outcome);
	if (mark.outcome === "violated") {
		span.addEvent(PROMISE_MARK.violatedEvent, {
			[PROMISE_MARK.symptom]: (mark.symptom ?? "violated").slice(0, 500),
		});
	}
}
