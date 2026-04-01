/**
 * OpenTelemetry Instrumentation for Next.js
 *
 * This file is automatically loaded by Next.js via the instrumentation hook (13.4+).
 * Place it in the app root (next to next.config.ts).
 *
 * Configuration via environment variables:
 *   OTEL_SERVICE_NAME            — service name (defaults to "unknown-service")
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP backend URL
 *   OTEL_EXPORTER_OTLP_HEADERS  — auth headers for the backend
 *
 * Install: pnpm add @vercel/otel
 */

import { registerOTel } from "@vercel/otel";

export function register() {
	registerOTel({
		serviceName: process.env.OTEL_SERVICE_NAME ?? "unknown-service",
	});
}
