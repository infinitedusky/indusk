/**
 * OpenTelemetry Auto-Instrumentation
 *
 * This file sets up automatic tracing for HTTP, database, and framework calls.
 * Load it before your application code:
 *
 *   node -r ./instrumentation.ts src/index.ts
 *
 * Or for Next.js, this file is automatically loaded via the instrumentation hook.
 *
 * Configuration via environment variables:
 *   OTEL_SERVICE_NAME          — service name (defaults to "otel-test-v2")
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP backend URL (if not set, uses console exporter)
 *   OTEL_EXPORTER_OTLP_HEADERS  — auth headers for the backend (e.g., "Authorization=Bearer xxx")
 *   OTEL_ENABLED_CATEGORIES     — comma-separated categories to export (default: all)
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
	ConsoleSpanExporter,
	BatchSpanProcessor,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FilteringExporter } from "./filtering-exporter";

// Determine the span exporter based on whether an OTLP endpoint is configured
function createSpanProcessor() {
	if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
		// OTLP endpoint configured — send traces to backend, filtered by category
		const otlpExporter = new OTLPTraceExporter();
		const filtered = new FilteringExporter(otlpExporter);
		return new BatchSpanProcessor(filtered);
	}
	// No backend — use console exporter for local development
	return new SimpleSpanProcessor(new ConsoleSpanExporter());
}

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]:
			process.env.OTEL_SERVICE_NAME ?? "unknown-service",
	}),
	spanProcessors: [createSpanProcessor()],
	instrumentations: [
		getNodeAutoInstrumentations({
			// Disable fs instrumentation — too noisy, not useful for most apps
			"@opentelemetry/instrumentation-fs": { enabled: false },
			// Disable dns — rarely useful, adds noise
			"@opentelemetry/instrumentation-dns": { enabled: false },
		}),
	],
});

sdk.start();

// Graceful shutdown on process exit
process.on("SIGTERM", () => {
	sdk.shutdown().finally(() => process.exit(0));
});
