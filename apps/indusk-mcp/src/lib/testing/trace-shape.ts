import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	type ReadableSpan,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { PROMISE_MARK, parsePromiseToken } from "../promises/vocabulary.js";

/**
 * Asserting a behaviour promise in a test (day-monitor, ADR D3).
 *
 * An application marks a promise with plain OpenTelemetry — two attributes
 * and, on a violation, an event (`PROMISE_MARK`). A test runs the call under
 * `captureSpans`, which owns the global tracer for the call's duration, and
 * asserts the mark with `expectPromiseUpheld` / `expectPromiseViolated`.
 *
 * The assertions are containment, not snapshots: other attributes, other
 * spans and extra children never fail them, and the one thing that does is
 * the marked span being gone (A5). They take the promise as its token,
 * `"promise: <name>"` — the same string `indusk promises check` counts, so
 * the assertion is also the promise's test link with no other citation (A6).
 *
 * Failures are plain `Error`s, so any test runner reports them.
 */

export interface CapturedSpan {
	name: string;
	spanId: string;
	/** The parent span's id, or "" for a root. */
	parentSpanId: string;
	/** The parent span's name when it was captured in the same call, else null. */
	parentName: string | null;
	attributes: Record<string, unknown>;
	events: { name: string; attributes: Record<string, unknown> }[];
}

function toCaptured(spans: ReadableSpan[]): CapturedSpan[] {
	const nameById = new Map(spans.map((s) => [s.spanContext().spanId, s.name]));
	return spans.map((s) => {
		const parentSpanId = s.parentSpanContext?.spanId ?? "";
		return {
			name: s.name,
			spanId: s.spanContext().spanId,
			parentSpanId,
			parentName: nameById.get(parentSpanId) ?? null,
			attributes: { ...s.attributes },
			events: s.events.map((e) => ({ name: e.name, attributes: { ...(e.attributes ?? {}) } })),
		};
	});
}

/**
 * Run `fn` with a tracer that records every span it ends, and return them.
 * Throws when another tracer provider is already registered globally — the
 * spans would go there, and an empty capture would read as "not marked".
 */
export async function captureSpans(fn: () => unknown): Promise<CapturedSpan[]> {
	const exporter = new InMemorySpanExporter();
	const provider = new BasicTracerProvider({
		spanProcessors: [new SimpleSpanProcessor(exporter)],
	});
	const contextManager = new AsyncLocalStorageContextManager().enable();
	if (!context.setGlobalContextManager(contextManager)) {
		contextManager.disable();
		throw new Error(
			"captureSpans: a global OpenTelemetry context manager is already registered; captureSpans must own it for the call",
		);
	}
	if (!trace.setGlobalTracerProvider(provider)) {
		context.disable();
		throw new Error(
			"captureSpans: a global OpenTelemetry tracer provider is already registered; its spans would not be captured",
		);
	}
	try {
		await fn();
		await provider.forceFlush();
		return toCaptured(exporter.getFinishedSpans());
	} finally {
		await provider.shutdown();
		trace.disable();
		context.disable();
	}
}

function nameFromToken(token: string, caller: string): string {
	const name = parsePromiseToken(token);
	if (name === null) {
		throw new Error(
			`${caller}: expected a promise token "promise: <name>", got "${token}" — the token is what makes this assertion the promise's test link`,
		);
	}
	return name;
}

function markedFor(spans: CapturedSpan[], name: string): CapturedSpan[] {
	return spans.filter((s) => s.attributes[PROMISE_MARK.promise] === name);
}

function describeMarks(spans: CapturedSpan[]): string {
	const marked = spans.filter((s) => s.attributes[PROMISE_MARK.promise] !== undefined);
	if (marked.length === 0)
		return `no span carried ${PROMISE_MARK.promise} (${spans.length} captured)`;
	return `marked spans: ${marked
		.map(
			(s) =>
				`${s.name} [${String(s.attributes[PROMISE_MARK.promise])}: ${String(s.attributes[PROMISE_MARK.outcome])}]`,
		)
		.join(", ")}`;
}

/**
 * Assert a captured span marks `token`'s promise upheld — under a parent
 * span named `parent`, when given. Returns the matching span.
 */
export function expectPromiseUpheld(
	spans: CapturedSpan[],
	token: string,
	options: { parent?: string } = {},
): CapturedSpan {
	const name = nameFromToken(token, "expectPromiseUpheld");
	const upheld = markedFor(spans, name).filter(
		(s) => s.attributes[PROMISE_MARK.outcome] === "upheld",
	);
	if (upheld.length === 0) {
		throw new Error(
			`expectPromiseUpheld: no span marked promise "${name}" upheld; ${describeMarks(spans)}`,
		);
	}
	if (options.parent === undefined) return upheld[0];
	const underParent = upheld.find((s) => s.parentName === options.parent);
	if (!underParent) {
		throw new Error(
			`expectPromiseUpheld: promise "${name}" was upheld, but not under "${options.parent}" (parents: ${upheld.map((s) => s.parentName ?? "(root)").join(", ")})`,
		);
	}
	return underParent;
}

/**
 * Assert a captured span marks `token`'s promise violated, with the
 * violation event. Returns the span and the event's symptom.
 */
export function expectPromiseViolated(
	spans: CapturedSpan[],
	token: string,
): { span: CapturedSpan; symptom: string | null } {
	const name = nameFromToken(token, "expectPromiseViolated");
	for (const span of markedFor(spans, name)) {
		if (span.attributes[PROMISE_MARK.outcome] !== "violated") continue;
		const event = span.events.find((e) => e.name === PROMISE_MARK.violatedEvent);
		if (!event) {
			throw new Error(
				`expectPromiseViolated: span "${span.name}" marks promise "${name}" violated but carries no ${PROMISE_MARK.violatedEvent} event`,
			);
		}
		const symptom = event.attributes[PROMISE_MARK.symptom];
		return { span, symptom: typeof symptom === "string" ? symptom : null };
	}
	throw new Error(
		`expectPromiseViolated: no span marked promise "${name}" violated; ${describeMarks(spans)}`,
	);
}
