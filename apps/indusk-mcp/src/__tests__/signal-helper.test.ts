// clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause
// clause: an-app-writes-its-signal-from-a-helper-it-owns/a-test-run-says-so
//
// a-new-project-starts-instrumented, Build Phase 2: T13 (and T15's helper half) - a signal
// the helper template writes reads back through the package's own span reader as that
// promise, clause and verdict; and under a test runner (this file is one) the helper's
// span carries the test-run marker.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { describe, expect, it } from "vitest";
import { parseMarkedSpan } from "../lib/promises/telemetry.js";

const HELPER = join(__dirname, "../../templates/signal.ts");

/** The span as Jaeger would hand it back: attributes as tags, events as logs (as signal-writers.test.ts does). */
const asJaegerSpan = (s: ReadableSpan) => ({
	traceID: s.spanContext().traceId,
	spanID: s.spanContext().spanId,
	operationName: s.name,
	startTime: 1_000_000,
	duration: 1_000,
	processID: "p",
	tags: Object.entries(s.attributes).map(([key, value]) => ({ key, value: String(value) })),
	logs: s.events.map((e) => ({
		timestamp: 0,
		fields: [
			{ key: "event", value: e.name },
			...Object.entries(e.attributes ?? {}).map(([key, value]) => ({
				key,
				value: String(value),
			})),
		],
	})),
});

const exporter = new InMemorySpanExporter();
new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();

async function helper() {
	expect(existsSync(HELPER), "the package ships templates/signal.ts").toBe(true);
	return (await import("../../templates/signal.js")).signal;
}

describe("the signal helper", () => {
	it("upheld and broken signals read back as written", async () => {
		const signal = await helper();
		signal.upheld({
			promise: "a-hold-is-released",
			clause: "on-time",
			value: 812,
			bound: 1000,
			plan: "p",
			phase: "Build Phase 2",
		});
		signal.broken({
			promise: "a-hold-is-released",
			clause: "on-time",
			symptom: "released 5.1 s late",
		});
		const [up, down] = exporter
			.getFinishedSpans()
			.map((s) => parseMarkedSpan(asJaegerSpan(s), "app"));
		expect(up).toMatchObject({
			promise: "a-hold-is-released",
			clause: "on-time",
			outcome: "upheld",
		});
		expect(down).toMatchObject({ outcome: "broken", symptom: "released 5.1 s late" });
	});

	it("T15: under a test runner the helper's span carries the test-run marker", async () => {
		const signal = await helper();
		exporter.reset();
		signal.upheld({ promise: "a-hold-is-released" });
		const [span] = exporter.getFinishedSpans();
		expect(span.attributes["indusk.run"]).toBe("test");
	});
});
