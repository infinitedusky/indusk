/**
 * The example's only telemetry: plain OpenTelemetry, exported over OTLP/HTTP
 * to whatever `OTEL_EXPORTER_OTLP_ENDPOINT` names (the local InDusk daemon on
 * a laptop, the project's server when deployed). Each release is a span
 * marked against the promise; nothing else in the app knows InDusk exists.
 *
 * promise: a-held-seat-is-released-in-time
 */
import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { detectResources, envDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { Release } from "./seats.js";

const PROMISE = "a-held-seat-is-released-in-time";

let provider: NodeTracerProvider | null = null;

/** Start exporting. Spans leave every half second, so a break shows quickly. */
export function startTelemetry(): void {
	const resource = detectResources({ detectors: [envDetector] }).merge(
		resourceFromAttributes({
			[ATTR_SERVICE_NAME]: "seat-holds",
			"deployment.environment": process.env.SEAT_HOLDS_ENV ?? "local",
		}),
	);
	provider = new NodeTracerProvider({
		resource,
		spanProcessors: [
			new BatchSpanProcessor(new OTLPTraceExporter(), { scheduledDelayMillis: 500 }),
		],
	});
	provider.register();
}

export async function stopTelemetry(): Promise<void> {
	await provider?.shutdown();
}

/** Mark one release: upheld when it came on time, violated when it came late. */
export function markRelease(r: Release): void {
	const span = trace.getTracer("seat-holds").startSpan("seat.release", {
		attributes: {
			"seat.number": r.seat,
			"seat.late_ms": r.lateMs,
			"indusk.promise": PROMISE,
			"indusk.promise.outcome": r.outcome,
		},
	});
	if (r.outcome === "violated" && r.symptom) {
		span.addEvent("indusk.promise.violated", { "indusk.promise.symptom": r.symptom });
	}
	span.end();
}
