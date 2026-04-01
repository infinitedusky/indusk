/**
 * OpenTelemetry Browser Instrumentation
 *
 * Captures page loads, HTTP requests (fetch/XHR), and user interactions
 * from the browser and sends them to any OTLP-compatible backend.
 *
 * Import this as early as possible in your app (main.tsx or App.tsx):
 *   import './instrumentation';
 *
 * Configuration via environment variables (use VITE_ or NEXT_PUBLIC_ prefix):
 *   VITE_OTEL_SERVICE_NAME            — service name
 *   VITE_OTEL_EXPORTER_OTLP_ENDPOINT — OTLP backend URL
 *   VITE_OTEL_EXPORTER_OTLP_HEADERS  — auth headers (e.g., "Authorization=Bearer xxx")
 *
 * Install:
 *   pnpm add @opentelemetry/sdk-trace-web @opentelemetry/instrumentation-fetch
 *   pnpm add @opentelemetry/instrumentation-document-load @opentelemetry/instrumentation-user-interaction
 *   pnpm add @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions
 */

import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor, SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

const endpoint =
	import.meta.env?.VITE_OTEL_EXPORTER_OTLP_ENDPOINT
	?? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT
	?? "";

const headers =
	import.meta.env?.VITE_OTEL_EXPORTER_OTLP_HEADERS
	?? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS
	?? "";

const serviceName =
	import.meta.env?.VITE_OTEL_SERVICE_NAME
	?? process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME
	?? "unknown-service";

// Parse headers string: "Key1=Value1,Key2=Value2" → { Key1: "Value1", Key2: "Value2" }
function parseHeaders(headerStr: string): Record<string, string> {
	if (!headerStr) return {};
	const result: Record<string, string> = {};
	for (const pair of headerStr.split(",")) {
		const eqIdx = pair.indexOf("=");
		if (eqIdx > 0) {
			result[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
		}
	}
	return result;
}

const provider = new WebTracerProvider({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: serviceName,
	}),
});

if (endpoint) {
	const exporter = new OTLPTraceExporter({
		url: `${endpoint}/v1/traces`,
		headers: parseHeaders(headers),
	});
	provider.addSpanProcessor(new BatchSpanProcessor(exporter));
} else {
	provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
}

provider.register();

registerInstrumentations({
	instrumentations: [
		new FetchInstrumentation(),
		new DocumentLoadInstrumentation(),
		new UserInteractionInstrumentation(),
	],
});
