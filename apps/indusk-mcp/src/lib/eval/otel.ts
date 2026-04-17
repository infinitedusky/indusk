/**
 * OpenTelemetry tracing for the eval agent (evaluator).
 *
 * Opt-in via `eval.otel.enabled: true` in `.indusk/config.json` OR
 * `INDUSK_EVAL_OTEL=1` env var. Exports to `OTEL_EXPORTER_OTLP_ENDPOINT`
 * (Dash0 or any OTLP HTTP receiver).
 *
 * Default OFF — zero cost in normal operation (no SDK init, no network).
 *
 * Graceful degradation: when enabled but endpoint missing, log a warning
 * to `.indusk/eval/system.log` and return a no-op tracer. When SDK init
 * throws, same behavior. The evaluator never fails because of OTel.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { type Attributes, type Span, SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const TRACER_NAME = "@infinitedusky/indusk-mcp/eval";
const SERVICE_NAME = "indusk-eval-agent";

function syslog(projectRoot: string, msg: string): void {
	try {
		const logDir = resolve(projectRoot, ".indusk", "eval");
		mkdirSync(logDir, { recursive: true });
		appendFileSync(resolve(logDir, "system.log"), `${new Date().toISOString()} ${msg}\n`);
	} catch {
		// logging should never break anything
	}
}

export interface EvalOtelConfig {
	enabled: boolean;
	endpoint: string | null;
	dataset: string;
}

const DEFAULT_DATASET = "agent";

/**
 * Pure predicate — reads `.indusk/config.json` `eval.otel.{enabled,dataset}` and
 * the `INDUSK_EVAL_OTEL` / `INDUSK_EVAL_OTEL_DATASET` / `OTEL_EXPORTER_OTLP_ENDPOINT`
 * env vars. Does not init anything or touch the network.
 *
 * Resolution:
 * - `enabled`: `INDUSK_EVAL_OTEL=1` (truthy) wins, else config `eval.otel.enabled`, else false.
 * - `endpoint`: `OTEL_EXPORTER_OTLP_ENDPOINT` (null if unset).
 * - `dataset`: `INDUSK_EVAL_OTEL_DATASET` env var wins, else config `eval.otel.dataset`,
 *   else `"agent"` default. Sent as the `Dash0-Dataset` header on every OTLP export.
 */
export function isEvalOtelEnabled(projectRoot: string): EvalOtelConfig {
	const envFlag = process.env.INDUSK_EVAL_OTEL;
	const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null;
	const envDataset = process.env.INDUSK_EVAL_OTEL_DATASET;
	let configEnabled = false;
	let configDataset: string | undefined;

	const configPath = join(projectRoot, ".indusk", "config.json");
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			configEnabled = config?.eval?.otel?.enabled === true;
			if (typeof config?.eval?.otel?.dataset === "string") {
				configDataset = config.eval.otel.dataset;
			}
		} catch {
			// malformed config — treat as disabled
		}
	}

	const envForcesEnabled =
		envFlag !== undefined && envFlag !== "" && envFlag !== "0" && envFlag.toLowerCase() !== "false";

	const dataset = envDataset && envDataset !== "" ? envDataset : (configDataset ?? DEFAULT_DATASET);

	return {
		enabled: envForcesEnabled || configEnabled,
		endpoint,
		dataset,
	};
}

let activeProvider: NodeTracerProvider | null = null;

/**
 * Initialize OTel tracing for the evaluator if enabled + endpoint set.
 * Returns a Tracer — real when enabled, no-op when not.
 *
 * The no-op path costs nothing: no provider registered, no network, the
 * returned tracer's `startSpan` / `startActiveSpan` produce no-op spans.
 *
 * Safe to call multiple times — subsequent calls return the same tracer.
 */
export function initEvalOtel(projectRoot: string): Tracer {
	const { enabled, endpoint, dataset } = isEvalOtelEnabled(projectRoot);

	if (!enabled) {
		return trace.getTracer(TRACER_NAME);
	}

	if (!endpoint) {
		syslog(
			projectRoot,
			"eval.otel.enabled but OTEL_EXPORTER_OTLP_ENDPOINT is unset — falling back to no-op tracer",
		);
		return trace.getTracer(TRACER_NAME);
	}

	if (activeProvider) {
		return trace.getTracer(TRACER_NAME);
	}

	try {
		const exporter = new OTLPTraceExporter({
			url: endpoint.endsWith("/v1/traces") ? endpoint : `${endpoint.replace(/\/$/, "")}/v1/traces`,
			// Route agent spans to the Dash0 dataset named `dataset`. Default
			// is "agent". Env-set headers (OTEL_EXPORTER_OTLP_HEADERS) take
			// precedence — per the OTel SDK contract — so a user-provided
			// Dash0-Dataset in env overrides this default.
			headers: {
				"Dash0-Dataset": dataset,
			},
		});

		const provider = new NodeTracerProvider({
			resource: resourceFromAttributes({
				[ATTR_SERVICE_NAME]: SERVICE_NAME,
			}),
			spanProcessors: [new BatchSpanProcessor(exporter)],
		});

		provider.register();
		activeProvider = provider;

		syslog(projectRoot, `eval.otel initialized — endpoint: ${endpoint}, dataset: ${dataset}`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		syslog(projectRoot, `eval.otel init failed — falling back to no-op tracer: ${message}`);
	}

	return trace.getTracer(TRACER_NAME);
}

/**
 * Run `fn` inside an active span. Closes the span in `finally`. On thrown
 * error, records the exception on the span and sets status to ERROR, then
 * re-throws so callers can still handle it.
 *
 * Use this for every lifecycle step in the evaluator so spans close even
 * when Claude exits non-zero or a downstream step throws.
 */
export async function withSpan<T>(
	tracer: Tracer,
	name: string,
	attrs: Attributes | undefined,
	fn: (span: Span) => Promise<T> | T,
): Promise<T> {
	return tracer.startActiveSpan(name, { attributes: attrs ?? {} }, async (span) => {
		try {
			return await fn(span);
		} catch (err) {
			span.recordException(err instanceof Error ? err : new Error(String(err)));
			span.setStatus({ code: SpanStatusCode.ERROR });
			throw err;
		} finally {
			span.end();
		}
	});
}

/**
 * Flush and shut down the active provider. Call this before `process.exit()`
 * in detached processes so batched spans are not lost. No-op if no provider
 * is active.
 */
export async function shutdownEvalOtel(): Promise<void> {
	if (!activeProvider) return;
	try {
		await activeProvider.forceFlush();
		await activeProvider.shutdown();
	} catch {
		// shutdown is best-effort
	} finally {
		activeProvider = null;
	}
}

/**
 * Test hook: reset the module's state AND the global OTel API so each test
 * starts fresh. Not part of the public API.
 */
export function __resetEvalOtelForTests(): void {
	// Tear down any provider left over from a previous test. This un-registers
	// from the global OTel API, so `trace.getTracer()` falls back to the no-op
	// tracer until a new provider is registered.
	if (activeProvider) {
		void activeProvider.shutdown().catch(() => {});
	}
	activeProvider = null;
	trace.disable();
}
