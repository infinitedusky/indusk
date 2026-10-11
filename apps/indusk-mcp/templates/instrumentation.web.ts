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
 *   VITE_OTEL_PROPAGATE_TO           — origins your API lives on, comma-separated
 *                                      (e.g., "http://localhost:3000,https://*.dev.example.com")
 *
 * Trace propagation: a request to this page's own origin carries the click's trace
 * (a `traceparent` header). A request to another origin carries it only when that
 * origin is named in OTEL_PROPAGATE_TO; an entry containing `*` is a pattern where
 * `*` matches one or more characters other than "/" and ".". Empty means same-origin
 * only. The API you name must also allow the `traceparent` header in its CORS settings
 * (Access-Control-Allow-Headers), or the browser blocks the request.
 *
 * Install:
 *   pnpm add @opentelemetry/sdk-trace-web @opentelemetry/instrumentation-fetch
 *   pnpm add @opentelemetry/instrumentation-document-load @opentelemetry/instrumentation-user-interaction
 *   pnpm add @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions
 */

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	BatchSpanProcessor,
	ConsoleSpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time; a Vite page has no `process`.
const hasProcess = typeof process !== "undefined";

const endpoint =
	import.meta.env?.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ??
	(hasProcess ? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT : undefined) ??
	"";

const headers =
	import.meta.env?.VITE_OTEL_EXPORTER_OTLP_HEADERS ??
	(hasProcess ? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS : undefined) ??
	"";

const serviceName =
	import.meta.env?.VITE_OTEL_SERVICE_NAME ??
	(hasProcess ? process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME : undefined) ??
	"unknown-service";

const propagateTo =
	import.meta.env?.VITE_OTEL_PROPAGATE_TO ??
	(hasProcess ? process.env.NEXT_PUBLIC_OTEL_PROPAGATE_TO : undefined) ??
	"";

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

// "http://localhost:3000,https://*.dev.example.com" → one RegExp per entry, anchored at
// both ends: the origin, then a path, query, fragment or nothing. `*` is one or more
// characters other than "/" and "."; everything else is literal.
function parsePropagateTo(list: string): RegExp[] {
	return list
		.split(",")
		.map((entry) => entry.trim().replace(/\/+$/, ""))
		.filter(Boolean)
		.map((entry) => {
			const source = entry
				.split("*")
				.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
				.join("[^/.]+");
			return new RegExp(`^${source}(?:[/?#]|$)`);
		});
}

const spanProcessors = [
	endpoint
		? new BatchSpanProcessor(
				new OTLPTraceExporter({
					url: `${endpoint}/v1/traces`,
					headers: parseHeaders(headers),
				}),
			)
		: new SimpleSpanProcessor(new ConsoleSpanExporter()),
];

const provider = new WebTracerProvider({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: serviceName,
	}),
	spanProcessors,
});

provider.register();

registerInstrumentations({
	instrumentations: [
		new FetchInstrumentation({
			propagateTraceHeaderCorsUrls: parsePropagateTo(propagateTo),
		}),
		new DocumentLoadInstrumentation(),
		new UserInteractionInstrumentation(),
	],
});
