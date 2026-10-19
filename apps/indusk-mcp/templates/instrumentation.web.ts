/**
 * OpenTelemetry Browser Instrumentation
 *
 * Captures page loads, HTTP requests (fetch/XHR), and user interactions
 * from the browser and sends them to an OTLP collector.
 *
 * Import this as early as possible in your app (main.tsx or App.tsx):
 *   import './instrumentation';
 *
 * Where spans go, the service name and the resource come from ./telemetry-settings:
 * with nothing set, the local InDusk daemon (`indusk telemetry address`).
 *
 * Configuration via environment variables (use VITE_ or NEXT_PUBLIC_ prefix; each wins
 * over the settings file):
 *   VITE_OTEL_SERVICE_NAME            — service name
 *   VITE_OTEL_EXPORTER_OTLP_ENDPOINT — OTLP collector URL
 *   VITE_OTEL_RESOURCE_ATTRIBUTES    — e.g. "deployment.environment=production"
 *   VITE_OTEL_EXPORTER_OTLP_HEADERS  — auth headers (e.g., "Authorization=Bearer xxx")
 *   VITE_OTEL_PROPAGATE_TO           — origins your API lives on, comma-separated
 *                                      (e.g., "http://localhost:3000,https://*.dev.example.com")
 *                                      each entry is an origin with its scheme; it may
 *                                      carry a path, and may write a default port
 *
 * Trace propagation: a request to this page's own origin carries the click's trace
 * (a `traceparent` header). A request to another origin carries it only when that
 * origin is named in OTEL_PROPAGATE_TO; an entry containing `*` is a pattern where
 * `*` matches one or more characters other than "/" and ".". An entry with a path covers
 * that path and what is under it, compared as written; a query or fragment is ignored.
 * Empty means same-origin only. The API you name must also allow the `traceparent` header in its CORS settings
 * (Access-Control-Allow-Headers), or the browser blocks the request.
 *
 * Install:
 *   pnpm add @opentelemetry/sdk-trace-web @opentelemetry/instrumentation-fetch
 *   pnpm add @opentelemetry/instrumentation-xml-http-request @opentelemetry/instrumentation-document-load
 *   pnpm add @opentelemetry/instrumentation-user-interaction
 *   pnpm add @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions
 */

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { telemetrySettings } from "./telemetry-settings";

// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time; a Vite page has no `process`.
const hasProcess = typeof process !== "undefined";

const viteEnv = import.meta.env ?? {};

// The settings read the OTEL_* names; in a page they arrive under the bundler's prefix.
// Each NEXT_PUBLIC_ name is spelled out, because Next.js inlines only literal reads.
const settings = telemetrySettings({
	OTEL_EXPORTER_OTLP_ENDPOINT:
		viteEnv.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ??
		(hasProcess ? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT : undefined),
	OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
		viteEnv.VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
		(hasProcess ? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT : undefined),
	OTEL_SERVICE_NAME:
		viteEnv.VITE_OTEL_SERVICE_NAME ??
		(hasProcess ? process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME : undefined),
	OTEL_RESOURCE_ATTRIBUTES:
		viteEnv.VITE_OTEL_RESOURCE_ATTRIBUTES ??
		(hasProcess ? process.env.NEXT_PUBLIC_OTEL_RESOURCE_ATTRIBUTES : undefined),
	MODE: viteEnv.MODE,
	NODE_ENV: hasProcess ? process.env.NODE_ENV : undefined,
});

const headers =
	viteEnv.VITE_OTEL_EXPORTER_OTLP_HEADERS ??
	(hasProcess ? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS : undefined) ??
	"";

const propagateTo =
	viteEnv.VITE_OTEL_PROPAGATE_TO ??
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

// "http://localhost:3000,https://*.dev.example.com/v1" → one RegExp per entry, anchored at
// both ends: what the entry names, then "/", "?", "#" or nothing — so a path covers
// itself and what is under it, and nothing beside it (/v1 covers /v1/seats, not /v10).
// An entry without `*` is normalized the way the browser spells a request URL (lower-case
// host, default port dropped); `*` is one or more characters other than "/" and ".",
// everything else literal. Scheme and host are lower-cased and compared as such; a path
// is compared as written, because a server tells /Admin from /admin. A default port written in a pattern entry is optional, as it
// is in the URL a request carries. An entry that does not begin `<scheme>://` can never
// match a request, so it is dropped with a warning rather than left to do nothing silently.
const ENTRY_WITH_SCHEME = /^(?:[a-z][a-z0-9+.-]*|\*):\/\//i;
const DEFAULT_PORT: Record<string, string> = { http: "80", https: "443" };

// promise: a-propagation-entry-covers-what-it-names — an entry sends the click's trace to
// the requests it names and to no others; the rules above are what "names" means.
function parsePropagateTo(list: string): RegExp[] {
	const patterns: RegExp[] = [];
	for (const raw of list.split(",")) {
		// A query or fragment names no resource a request is matched on: cut it, for every entry.
		const entry = raw
			.trim()
			.replace(/[?#].*$/, "")
			.replace(/\/+$/, "");
		if (!entry) continue;
		if (!ENTRY_WITH_SCHEME.test(entry)) {
			console.warn(
				`OTEL_PROPAGATE_TO: ignoring "${entry}" — an entry is an origin with its scheme, e.g. https://api.example.com`,
			);
			continue;
		}
		const named = entry.includes("*") ? entry : normalizeExactEntry(entry);
		patterns.push(new RegExp(`^${entrySource(named)}(?:[/?#]|$)`));
	}
	return patterns;
}

/** An entry with no `*`, spelled the way a request URL is: origin and path, no query or fragment. */
function normalizeExactEntry(entry: string): string {
	try {
		const url = new URL(entry);
		return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
	} catch {
		return entry;
	}
}

/** The RegExp source for what an entry names: `*` as a wildcard, a default port as optional. */
function entrySource(entry: string): string {
	const literal = (text: string) =>
		text
			.split("*")
			.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
			.join("[^/.]+");
	const parts = /^([^:]+):\/\/([^/?#]*)(.*)$/.exec(entry);
	if (!parts) return literal(entry);
	const [, scheme, authority, rest] = parts;
	const port = /:(\d+)$/.exec(authority);
	const optionalPort = port !== null && DEFAULT_PORT[scheme.toLowerCase()] === port[1];
	const host = optionalPort ? authority.slice(0, -port[0].length) : authority;
	return `${literal(`${scheme}://${host}`.toLowerCase())}${optionalPort ? `(?::${port[1]})?` : ""}${literal(rest)}`;
}

const provider = new WebTracerProvider({
	resource: resourceFromAttributes(settings.resource),
	spanProcessors: [
		new BatchSpanProcessor(
			new OTLPTraceExporter({ url: settings.tracesUrl, headers: parseHeaders(headers) }),
		),
	],
});

provider.register();

const propagateTraceHeaderCorsUrls = parsePropagateTo(propagateTo);

// promise: a-click-and-its-server-work-share-a-trace — the click's trace goes to the
// project's own services: same-origin by default, the named origins and patterns above.
registerInstrumentations({
	instrumentations: [
		new FetchInstrumentation({ propagateTraceHeaderCorsUrls }),
		new XMLHttpRequestInstrumentation({ propagateTraceHeaderCorsUrls }),
		new DocumentLoadInstrumentation(),
		new UserInteractionInstrumentation(),
	],
});
