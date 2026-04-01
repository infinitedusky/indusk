/**
 * Structured Logger — Pino with OpenTelemetry transport
 *
 * Dual output:
 *   1. stdout — always, for local dev and Docker logs
 *   2. OTLP — when OTEL_EXPORTER_OTLP_ENDPOINT is set, sends logs to backend
 *
 * Usage:
 *   import { logger } from './logger';
 *   logger.info({ roomCode, players }, 'hand started');
 *   logger.error({ err, traceId }, 'settlement failed');
 *
 * Log levels:
 *   ERROR — something is broken, needs immediate attention
 *   WARN  — degraded but functional, investigate soon
 *   INFO  — business events, state transitions (the useful stuff)
 *   DEBUG — development details, disable in production
 */

import pino from "pino";
import type { TransportTargetOptions } from "pino";

const targets: TransportTargetOptions[] = [
	// Always log to stdout
	{
		target: "pino/file",
		options: { destination: 1 },
	},
];

// If an OTLP endpoint is configured, also send logs there
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
	targets.push({
		target: "pino-opentelemetry-transport",
		options: {
			logRecordProcessorOptions: [
				{
					recordProcessorType: "batch",
					exporterOptions: {
						protocol: "http",
					},
				},
			],
		},
	});
}

export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	transport: { targets },
});
