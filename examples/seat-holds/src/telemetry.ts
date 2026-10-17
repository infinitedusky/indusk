/**
 * The example's only telemetry setup: plain OpenTelemetry, exported over OTLP/HTTP to
 * where `./telemetry-settings` says (the local InDusk daemon unless
 * `OTEL_EXPORTER_OTLP_ENDPOINT` names another, such as the project's server when
 * deployed). The promise's signal is written from `server.ts` through `./signal`;
 * nothing else in the app knows InDusk exists.
 */
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { detectResources, envDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { telemetrySettings } from "./telemetry-settings.js";

let provider: NodeTracerProvider | null = null;

/**
 * What every span says about where it ran: the settings' project and environment
 * (`development` unless set), under the example's own service name, so a copy under
 * another folder still reports as it. `SEAT_HOLDS_ENV`, which the Dockerfile and
 * `fly.toml` set to `production`, names the environment when it is set.
 */
export function demoResourceAttributes(env: NodeJS.ProcessEnv): Record<string, string> {
	return {
		...telemetrySettings(env).resource,
		"service.name": "seat-holds",
		...(env.SEAT_HOLDS_ENV ? { "deployment.environment": env.SEAT_HOLDS_ENV } : {}),
	};
}

/** Start exporting. Spans leave every half second, so a break shows quickly. */
export function startTelemetry(): void {
	const settings = telemetrySettings(process.env);
	const resource = detectResources({ detectors: [envDetector] }).merge(
		resourceFromAttributes(demoResourceAttributes(process.env)),
	);
	provider = new NodeTracerProvider({
		resource,
		spanProcessors: [
			new BatchSpanProcessor(new OTLPTraceExporter({ url: settings.tracesUrl }), {
				scheduledDelayMillis: 500,
			}),
		],
	});
	provider.register();
}

export async function stopTelemetry(): Promise<void> {
	await provider?.shutdown();
}
