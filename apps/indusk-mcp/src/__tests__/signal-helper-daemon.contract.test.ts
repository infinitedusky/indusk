// clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause
//
// a-new-project-starts-instrumented, Build Phase 2: T14 - a system-tier file (it starts a
// daemon in a temporary home). A signal the helper writes from an app exporting to a real
// daemon is found in its Jaeger and read as the promise, clause and verdict given, with
// the project and the environment.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterAll, beforeAll, expect, it } from "vitest";
import { jaegerEndpoint, marksBetween } from "../lib/promises/telemetry.js";
import { type LocalJaeger, startLocalJaeger } from "./helpers/local-jaeger.js";

const HELPER = join(__dirname, "../../templates/signal.ts");

let jaeger: LocalJaeger;
beforeAll(async () => {
	jaeger = await startLocalJaeger();
}, 120_000);
afterAll(() => jaeger?.stop());

it("a helper signal reaches the daemon and reads back with project and environment", async () => {
	expect(existsSync(HELPER), "the package ships templates/signal.ts").toBe(true);
	const { telemetrySettings } = await import("../../templates/telemetry-settings.js");
	const { signal } = await import("../../templates/signal.js");
	const s = telemetrySettings(
		{},
		{ service: "app", project: "app", traces: `http://localhost:${jaeger.otlpPort}`, logs: "" },
	);
	const provider = new NodeTracerProvider({
		resource: resourceFromAttributes(s.resource),
		spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: s.tracesUrl }))],
	});
	provider.register();
	const from = new Date();
	signal.upheld({ promise: "a-hold-is-released", clause: "on-time" });
	await provider.forceFlush();
	// Jaeger stores in batches: a span flushed now may not be queryable yet, so poll.
	let marks: Awaited<ReturnType<typeof marksBetween>>["marks"] = [];
	for (const deadline = Date.now() + 15_000; marks.length === 0 && Date.now() < deadline; ) {
		({ marks } = await marksBetween(jaegerEndpoint(jaeger.queryUrl), {
			service: "app",
			name: "a-hold-is-released",
			promise: "a-hold-is-released",
			from,
			to: new Date(Date.now() + 60_000),
			project: "app",
			timeoutMs: 5_000,
		}));
		if (marks.length === 0) await new Promise((r) => setTimeout(r, 250));
	}
	expect(marks[0]).toMatchObject({
		clause: "on-time",
		outcome: "upheld",
		environment: "development",
	});
}, 60_000);
