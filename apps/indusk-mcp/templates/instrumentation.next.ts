/**
 * OpenTelemetry Instrumentation for Next.js
 *
 * This file is automatically loaded by Next.js via the instrumentation hook (13.4+).
 * Place it in the app root (next to next.config.ts).
 *
 * Where spans go, the service name and the resource come from ./src/telemetry-settings:
 * with nothing set, the local InDusk daemon (`indusk telemetry address`).
 *
 * Configuration via environment variables (each wins over the settings file):
 *   OTEL_SERVICE_NAME            — service name
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP collector URL
 *   OTEL_EXPORTER_OTLP_HEADERS  — auth headers for the collector
 *   OTEL_RESOURCE_ATTRIBUTES    — e.g. "deployment.environment=production"
 *
 * Install: pnpm add @vercel/otel
 */

import { registerOTel } from "@vercel/otel";
import { telemetrySettings } from "./src/telemetry-settings";

export function register() {
	const settings = telemetrySettings(process.env);
	// @vercel/otel reads its endpoint from the environment: give it the settings' default.
	process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??= settings.tracesUrl;
	registerOTel({ serviceName: settings.serviceName, attributes: settings.resource });
}
