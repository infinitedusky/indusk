import type { JaegerSpan, JaegerTrace } from "../../lib/promises/telemetry.js";

/**
 * A Jaeger query API that answers from spans a test holds (one-promise-language).
 *
 * `/api/services` lists the services; `/api/traces` returns, for the asked
 * `service`, only the spans whose tags include every pair in the `tags`
 * query parameter — the filter a real Jaeger applies, which is what makes a
 * reader that asks only for one outcome word miss a span carrying the other.
 * Install it with `vi.stubGlobal("fetch", fakeJaegerFetch(spans))`; every
 * request is also appended to `asked`, so a test can say what was queried.
 */

export interface HeldSpan {
	service: string;
	name: string;
	/** Span tags beyond the promise mark, as `[key, value]`. */
	tags: Record<string, string>;
	/** The span's end, default now. */
	at?: Date;
	spanId: string;
}

export const jaegerSpan = (held: HeldSpan): { span: JaegerSpan; service: string } => {
	const end = (held.at ?? new Date()).getTime() * 1000;
	return {
		service: held.service,
		span: {
			traceID: `t-${held.spanId}`,
			spanID: held.spanId,
			operationName: held.name,
			startTime: end - 5_000,
			duration: 5_000,
			processID: "p1",
			tags: Object.entries(held.tags).map(([key, value]) => ({ key, value })),
			logs: [],
		},
	};
};

export function fakeJaegerFetch(spans: HeldSpan[], asked: string[] = []): typeof fetch {
	return (async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		asked.push(`${url.pathname}${url.search}`);
		const json = (data: unknown) =>
			new Response(JSON.stringify({ data }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		if (url.pathname === "/api/services") return json([...new Set(spans.map((s) => s.service))]);
		if (url.pathname === "/api/traces") {
			const service = url.searchParams.get("service");
			const want = JSON.parse(url.searchParams.get("tags") ?? "{}") as Record<string, string>;
			const traces: JaegerTrace[] = spans
				.filter((s) => s.service === service)
				.filter((s) => Object.entries(want).every(([k, v]) => s.tags[k] === v))
				.map((s) => {
					const { span } = jaegerSpan(s);
					return {
						traceID: span.traceID,
						spans: [span],
						processes: { p1: { serviceName: s.service } },
					};
				});
			return json(traces);
		}
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
}
