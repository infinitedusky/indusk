import type { Tracer } from "@opentelemetry/api";
import { markPromise } from "../promises/mark.js";
import { LOOK_MARK } from "../promises/vocabulary.js";
import type { Finding, Verdict } from "./verdict.js";

/**
 * A look reports like a promise (ui-promises ADR decision 7): each check run
 * emits one span per screen x state x device, marked with the same attributes
 * a promise's run carries (`markPromise`), so the local telemetry daemon's
 * Jaeger and the one health reader see a look beside every other mark. Held
 * is `upheld`; broken is `violated`, with what was seen on the event.
 *
 * promise: a-look-reports-like-any-promise
 */

/** The promise a look's mark is filed under: every element renders with its token's value. */
export const LOOK_PROMISE = "tokens-are-held-exactly";

export interface LookResult {
	app: string;
	screen: string;
	state: string;
	device: string;
	/** `story` for a component's story in the served Storybook (`screen` is its component); absent for a screen. */
	kind?: "story";
	verdict: Verdict;
}

/** One line for the violated event: what was seen first, and how many more. */
export function symptomOf(result: LookResult): string {
	const [first, ...rest] = result.verdict.findings;
	const where = `${result.kind === "story" ? "story " : ""}${result.screen}.${result.state} @ ${result.device}`;
	if (!first) return `${where}: broken`;
	const more = rest.length > 0 ? ` (+${rest.length} more)` : "";
	return `${where}: ${describe(first)}${more}`;
}

/** A finding in words: the token or the element and property, approved and actual, nearest. */
export function describe(f: Finding): string {
	if (f.token) return `token ${f.token} approved ${f.approved ?? "?"} actual ${f.actual}`;
	const near = f.nearest ? ` nearest ${f.nearest}` : "";
	return `element ${f.element} ${f.property} actual ${f.actual}${near}`;
}

/**
 * Emit the span for each result on `tracer`. Never throws: a check whose
 * telemetry is down still reports in its own output, as the recorder's mark
 * does.
 */
export function reportLooks(
	results: readonly LookResult[],
	tracer: Tracer,
	opts: { project?: string } = {},
): void {
	for (const result of results) {
		try {
			const span = tracer.startSpan("indusk.looks.check");
			span.setAttribute(LOOK_MARK.app, result.app);
			span.setAttribute(LOOK_MARK.screen, result.screen);
			span.setAttribute(LOOK_MARK.state, result.state);
			span.setAttribute(LOOK_MARK.device, result.device);
			if (result.kind === "story") span.setAttribute(LOOK_MARK.kind, "story");
			markPromise(span, {
				promise: LOOK_PROMISE,
				outcome: result.verdict.state === "held" ? "upheld" : "broken",
				...(opts.project ? { project: opts.project } : {}),
				...(result.verdict.state === "broken" ? { symptom: symptomOf(result) } : {}),
			});
			span.end();
		} catch {
			// best-effort
		}
	}
}
