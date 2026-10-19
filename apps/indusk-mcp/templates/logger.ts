/**
 * Structured Logger — Pino with OpenTelemetry transport
 *
 * Dual output:
 *   1. stdout — always, for local dev and Docker logs
 *   2. OTLP — to the logs address in ./telemetry-settings (the local daemon unless an endpoint is set)
 *
 * Usage:
 *   import { logger } from './logger';
 *   logger.info({ roomCode, players }, 'hand started');
 *   logger.error({ err, traceId }, 'settlement failed');
 *
 * Log levels:
 *   ERROR — something is broken, needs immediate attention
 *   WARN  — degraded but functional, investigate soon
 *   INFO  — what happened, for diagnosis
 *   DEBUG — development details, disable in production
 *
 * A log line is for diagnosis. A promise's signal is a span, written with `./signal`.
 */

import type { TransportTargetOptions } from "pino";
import pino from "pino";
import { telemetrySettings } from "./telemetry-settings";

const settings = telemetrySettings(process.env);

const targets: TransportTargetOptions[] = [
	// Always log to stdout
	{
		target: "pino/file",
		options: { destination: 1 },
	},
	// And to the logs address from the settings: the local daemon's logs port unless an endpoint is set
	{
		target: "pino-opentelemetry-transport",
		options: {
			resourceAttributes: settings.resource,
			logRecordProcessorOptions: [
				{
					recordProcessorType: "batch",
					exporterOptions: {
						protocol: "http",
						httpExporterOptions: { url: settings.logsUrl },
					},
				},
			],
		},
	},
];

export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	transport: { targets },
});
