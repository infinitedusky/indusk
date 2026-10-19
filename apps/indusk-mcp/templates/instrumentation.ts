/**
 * OpenTelemetry Auto-Instrumentation
 *
 * This file sets up automatic tracing for HTTP, database, and framework calls.
 * Load it before your application code:
 *
 *   node --import ./src/instrumentation.ts src/index.ts
 *
 * Where spans go, the service name and the resource come from ./telemetry-settings:
 * with nothing set, the local InDusk daemon (`indusk telemetry address`).
 *
 * Configuration via environment variables (each wins over the settings file):
 *   OTEL_SERVICE_NAME           — service name
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP collector URL
 *   OTEL_EXPORTER_OTLP_HEADERS  — auth headers for the collector (e.g., "Authorization=Bearer xxx")
 *   OTEL_RESOURCE_ATTRIBUTES    — e.g. "deployment.environment=production"
 *   OTEL_ENABLED_CATEGORIES     — comma-separated categories to export (default: all)
 */

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { FilteringExporter } from "./filtering-exporter";
import { telemetrySettings } from "./telemetry-settings";

const settings = telemetrySettings(process.env);

const sdk = new NodeSDK({
	resource: resourceFromAttributes(settings.resource),
	spanProcessors: [
		new BatchSpanProcessor(
			new FilteringExporter(new OTLPTraceExporter({ url: settings.tracesUrl })),
		),
	],
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
