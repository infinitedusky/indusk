import type { Tracer } from "@opentelemetry/api";

/** A tracer that keeps each span's attributes and events, for tests of signal writers. */
export interface CapturedSpan {
	attrs: Record<string, unknown>;
	events: Array<{ name: string; attrs?: Record<string, unknown> }>;
}

export function captureTracer(): { tracer: Tracer; spans: CapturedSpan[] } {
	const spans: CapturedSpan[] = [];
	const tracer = {
		startSpan: () => {
			const s: CapturedSpan = { attrs: {}, events: [] };
			spans.push(s);
			return {
				setAttribute: (k: string, v: unknown) => {
					s.attrs[k] = v;
				},
				addEvent: (name: string, attrs?: Record<string, unknown>) => {
					s.events.push({ name, attrs });
				},
				end: () => {},
			};
		},
	} as unknown as Tracer;
	return { tracer, spans };
}

/** The outcome each captured span wrote, by its clause. */
export function outcomesByClause(spans: CapturedSpan[]): Record<string, unknown> {
	return Object.fromEntries(
		spans.map((s) => [s.attrs["indusk.clause"], s.attrs["indusk.promise.outcome"]]),
	);
}
