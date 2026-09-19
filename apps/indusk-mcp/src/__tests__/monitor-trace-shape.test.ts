import {
	captureSpans,
	expectPromiseUpheld,
	expectPromiseViolated,
} from "@infinitedusky/indusk-mcp/testing/trace-shape";
import { trace } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

/**
 * day-monitor — A4, A5: the trace-shape helper, through the published
 * subpath (Build Phase 1; the body was reviewed in Test Phase 1's register).
 *
 * The fixture calls stand in for application code: they mark the promise with
 * plain OpenTelemetry, the way ADR D1 says an application does — no InDusk
 * import on the marking side.
 */

const FIXTURE = "fixture-promise";
// Built, not written out: a literal token here would cite an unregistered
// promise to this repository's own `promises check`.
const TOKEN = `promise: ${FIXTURE}`;

const tracer = () => trace.getTracer("fixture-app");

async function handleRequest(inner: () => void): Promise<void> {
	await tracer().startActiveSpan("handle-request", async (span) => {
		await Promise.resolve();
		inner();
		span.end();
	});
}

function holdSeat(opts: { mark: boolean; extraChild?: boolean }): void {
	tracer().startActiveSpan("hold-seat", (span) => {
		if (opts.mark) {
			span.setAttribute("indusk.promise", FIXTURE);
			span.setAttribute("indusk.promise.outcome", "upheld");
		}
		if (opts.extraChild) {
			span.setAttribute("seat.number", 4);
			tracer().startSpan("write-seat-row").end();
		}
		span.end();
	});
}

const fixtureCallThatUpholds = () => handleRequest(() => holdSeat({ mark: true }));
const fixtureCallWithExtraChild = () =>
	handleRequest(() => holdSeat({ mark: true, extraChild: true }));
const fixtureCallWithoutMark = () => handleRequest(() => holdSeat({ mark: false }));

describe("day-monitor — the trace-shape helper", () => {
	it("A4 — upheld under its parent", async () => {
		const spans = await captureSpans(() => fixtureCallThatUpholds());
		expectPromiseUpheld(spans, TOKEN, { parent: "handle-request" });
	});

	it("A5 — tolerant of harmless change, strict on the mark", async () => {
		const spans = await captureSpans(() => fixtureCallWithExtraChild());
		expectPromiseUpheld(spans, TOKEN);
		const unmarked = await captureSpans(() => fixtureCallWithoutMark());
		expect(() => expectPromiseUpheld(unmarked, TOKEN)).toThrow(/fixture-promise/);
	});

	it("refuses a bare name, so the call stays a token the check counts", async () => {
		const spans = await captureSpans(() => fixtureCallThatUpholds());
		expect(() => expectPromiseUpheld(spans, FIXTURE)).toThrow(/promise: <name>/);
	});

	it("a violation needs its event, and returns the symptom", async () => {
		const spans = await captureSpans(() =>
			tracer().startActiveSpan("hold-seat", (span) => {
				span.setAttribute("indusk.promise", FIXTURE);
				span.setAttribute("indusk.promise.outcome", "violated");
				span.addEvent("indusk.promise.violated", {
					"indusk.promise.symptom": "seat 4 held twice",
				});
				span.end();
			}),
		);
		expect(expectPromiseViolated(spans, TOKEN).symptom).toBe("seat 4 held twice");
	});
});
