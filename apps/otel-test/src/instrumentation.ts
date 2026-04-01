/**
 * OpenTelemetry Auto-Instrumentation
 *
 * Load before your application code:
 *   node --import ./src/instrumentation.ts src/index.ts
 *
 * Configuration via environment variables:
 *   OTEL_SERVICE_NAME            — service name (defaults to "otel-test")
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP backend URL (if not set, uses console exporter)
 *   OTEL_EXPORTER_OTLP_HEADERS  — auth headers for the backend
 *   OTEL_ENABLED_CATEGORIES     — comma-separated categories to export (default: all)
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FilteringExporter } from "./filtering-exporter";

const resource = resourceFromAttributes({
	[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "otel-test",
});

// Use OTLP if endpoint configured, otherwise console
const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
	? new FilteringExporter(new OTLPTraceExporter())
	: new ConsoleSpanExporter();

const sdk = new NodeSDK({
	resource,
	traceExporter,
	instrumentations: [
		getNodeAutoInstrumentations({
			"@opentelemetry/instrumentation-fs": { enabled: false },
			"@opentelemetry/instrumentation-dns": { enabled: false },
		}),
	],
});

sdk.start();
console.log(`OTel initialized: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? "OTLP" : "console"} exporter`);

process.on("SIGTERM", () => {
	sdk.shutdown().finally(() => process.exit(0));
});
