import type { Tracer } from "@opentelemetry/api";
import { markPromise } from "../promises/mark.js";
import { LOOK_MARK } from "../promises/vocabulary.js";
import type { Reused } from "./check.js";
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

/** One look span: its app, screen, state, device and kind, marked under `LOOK_PROMISE`. */
function startLookSpan(
	tracer: Tracer,
	look: { app: string; screen: string; state: string; device: string; kind?: "story" },
) {
	const span = tracer.startSpan("indusk.looks.check");
	span.setAttribute(LOOK_MARK.app, look.app);
	span.setAttribute(LOOK_MARK.screen, look.screen);
	span.setAttribute(LOOK_MARK.state, look.state);
	span.setAttribute(LOOK_MARK.device, look.device);
	if (look.kind === "story") span.setAttribute(LOOK_MARK.kind, "story");
	return span;
}

/**
 * Emit the span for each result on `tracer`, and for each reused look one
 * span per device and scheme it is reported under: upheld, marked
 * `indusk.look.reused` with `indusk.look.measured_at` the time it was really
 * measured. A reused span is the held result restated, never a measurement —
 * it keeps an unchanged look's standing holding, and a reader can always tell
 * it from a fresh one (Sandy, 2026-10-16). Never throws: a check whose
 * telemetry is down still reports in its own output, as the recorder's mark
 * does.
 */
export function reportLooks(
	results: readonly LookResult[],
	tracer: Tracer,
	opts: { project?: string; reused?: readonly Reused[] } = {},
): void {
	const project = opts.project ? { project: opts.project } : {};
	for (const result of results) {
		try {
			const span = startLookSpan(tracer, result);
			markPromise(span, {
				promise: LOOK_PROMISE,
				outcome: result.verdict.state === "held" ? "upheld" : "broken",
				...project,
				...(result.verdict.state === "broken" ? { symptom: symptomOf(result) } : {}),
			});
			span.end();
		} catch {
			// best-effort
		}
	}
	for (const look of opts.reused ?? []) {
		for (const device of look.devices) {
			try {
				const span = startLookSpan(tracer, {
					app: look.app,
					screen: look.screen,
					state: look.state,
					device,
					...(look.kind === "story" ? { kind: "story" as const } : {}),
				});
				markPromise(span, { promise: LOOK_PROMISE, outcome: "upheld", ...project });
				span.setAttribute(LOOK_MARK.reused, true);
				span.setAttribute(LOOK_MARK.measuredAt, look.at);
				span.end();
			} catch {
				// best-effort
			}
		}
	}
}
