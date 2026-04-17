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
import { type Logger, logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
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
 * the `INDUSK_EVAL_OTEL` / `INDUSK_EVAL_OTEL_DATASET` / `EVAL_AGENT_DATASET` /
 * `OTEL_EXPORTER_OTLP_ENDPOINT` env vars. Does not init anything or touch the network.
 *
 * Resolution:
 * - `enabled`: `INDUSK_EVAL_OTEL=1` (truthy) wins, else config `eval.otel.enabled`, else false.
 * - `endpoint`: `OTEL_EXPORTER_OTLP_ENDPOINT` (null if unset).
 * - `dataset` (priority, highest → lowest):
 *   1. `INDUSK_EVAL_OTEL_DATASET` env var (explicit per-invocation override)
 *   2. `EVAL_AGENT_DATASET` env var (composable.env convention — see env/components/dash0.env)
 *   3. `.indusk/config.json` `eval.otel.dataset`
 *   4. `"agent"` default
 *
 *   Sent as the `Dash0-Dataset` header on every OTLP export. Also rewritten into
 *   `OTEL_EXPORTER_OTLP_HEADERS` if present there (env headers beat constructor
 *   headers per OTel spec — so we fix the env header at the source).
 */
export function isEvalOtelEnabled(projectRoot: string): EvalOtelConfig {
	const envFlag = process.env.INDUSK_EVAL_OTEL;
	const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null;
	const explicitDataset = process.env.INDUSK_EVAL_OTEL_DATASET;
	const composableDataset = process.env.EVAL_AGENT_DATASET;
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

	const dataset =
		(explicitDataset && explicitDataset !== "" && explicitDataset) ||
		(composableDataset && composableDataset !== "" && composableDataset) ||
		configDataset ||
		DEFAULT_DATASET;

	return {
		enabled: envForcesEnabled || configEnabled,
		endpoint,
		dataset,
	};
}

/**
 * Rewrite the `Dash0-Dataset=<old>` entry in `OTEL_EXPORTER_OTLP_HEADERS` to
 * `Dash0-Dataset=<target>`. OTel spec says env-set headers override constructor
 * headers, so we have to fix the env directly for routing to work when the user's
 * shell already sets `OTEL_EXPORTER_OTLP_HEADERS` via composable.env.
 *
 * No-op if the env var is unset or doesn't contain `Dash0-Dataset=`.
 */
function rewriteDatasetInEnvHeaders(target: string): void {
	const current = process.env.OTEL_EXPORTER_OTLP_HEADERS;
	if (!current || !current.includes("Dash0-Dataset=")) return;
	const rewritten = current.replace(/Dash0-Dataset=[^,]*/g, `Dash0-Dataset=${target}`);
	process.env.OTEL_EXPORTER_OTLP_HEADERS = rewritten;
}

const LOGGER_NAME = "@infinitedusky/indusk-mcp/eval";

let activeProvider: NodeTracerProvider | null = null;
let activeLoggerProvider: LoggerProvider | null = null;

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

	// Ensure env-set OTEL_EXPORTER_OTLP_HEADERS routes to the eval agent's
	// dataset. Env headers beat constructor headers per OTel spec — so if the
	// user's shell (composable.env) already set Dash0-Dataset for project
	// telemetry, we rewrite it in-place to the eval agent dataset before the
	// exporter reads it.
	rewriteDatasetInEnvHeaders(dataset);

	// Build exporter headers. We pass Authorization and Dash0-Dataset in the
	// constructor rather than relying on OTEL_EXPORTER_OTLP_HEADERS env parsing,
	// because the OTel SDK's env parser has proven unreliable for tokens with
	// spaces (e.g., "Bearer auth_xxx") in practice — the header silently fails
	// to attach and exports retry-loop to no effect.
	//
	// Precedence:
	//   1. User-set `OTEL_EXPORTER_OTLP_HEADERS` env (handled by SDK, takes top precedence per OTel spec)
	//   2. Explicit constructor headers below (our defaults)
	//
	// DASH0_API_TOKEN is the conventional name we inherit from the Dash0 CLI.
	// If set, we build a Bearer header. If not, we rely on the user's env.
	const headers: Record<string, string> = {
		"Dash0-Dataset": dataset,
	};
	if (process.env.DASH0_API_TOKEN) {
		headers.Authorization = `Bearer ${process.env.DASH0_API_TOKEN}`;
	}

	try {
		const exporter = new OTLPTraceExporter({
			url: endpoint.endsWith("/v1/traces") ? endpoint : `${endpoint.replace(/\/$/, "")}/v1/traces`,
			headers,
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
 * Initialize the OTel logs pipeline alongside traces. Returns a Logger —
 * real when enabled + endpoint set, no-op otherwise. Shares the same
 * config gating + Dash0 dataset routing as `initEvalOtel`. Safe to call
 * multiple times.
 *
 * Log records emitted via `getEvalLogger().emit(...)` automatically
 * correlate with the active span via trace_id / span_id.
 */
export function initEvalOtelLogs(projectRoot: string): Logger {
	const { enabled, endpoint, dataset } = isEvalOtelEnabled(projectRoot);

	if (!enabled) return logs.getLogger(LOGGER_NAME);

	if (!endpoint) {
		syslog(projectRoot, "eval.otel.logs — endpoint unset; falling back to no-op logger");
		return logs.getLogger(LOGGER_NAME);
	}

	if (activeLoggerProvider) return logs.getLogger(LOGGER_NAME);

	rewriteDatasetInEnvHeaders(dataset);

	const headers: Record<string, string> = { "Dash0-Dataset": dataset };
	if (process.env.DASH0_API_TOKEN) {
		headers.Authorization = `Bearer ${process.env.DASH0_API_TOKEN}`;
	}

	try {
		const exporter = new OTLPLogExporter({
			url: endpoint.endsWith("/v1/logs") ? endpoint : `${endpoint.replace(/\/$/, "")}/v1/logs`,
			headers,
		});
		const provider = new LoggerProvider({
			resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: SERVICE_NAME }),
			processors: [new BatchLogRecordProcessor(exporter)],
		});
		// setGlobalLoggerProvider returns false if one is already registered
		// (e.g., a test's InMemoryLogRecordExporter provider). Respect that —
		// only retain ownership (and tear down at shutdown) if we actually
		// registered ours.
		const accepted = logs.setGlobalLoggerProvider(provider);
		if (accepted) {
			activeLoggerProvider = provider;
			syslog(
				projectRoot,
				`eval.otel.logs initialized — endpoint: ${endpoint}, dataset: ${dataset}`,
			);
		} else {
			syslog(projectRoot, "eval.otel.logs — global provider already set; using existing");
			// Fire-and-forget shutdown of the unused provider
			void provider.shutdown().catch(() => {});
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		syslog(projectRoot, `eval.otel.logs init failed — falling back to no-op: ${message}`);
	}

	return logs.getLogger(LOGGER_NAME);
}

/**
 * Accessor for the eval logger. Always safe to call — returns a no-op
 * logger when logs aren't initialized.
 */
export function getEvalLogger(): Logger {
	return logs.getLogger(LOGGER_NAME);
}

/**
 * Emit an info-severity log record with an arbitrary body. Shorthand for
 * `getEvalLogger().emit(...)`. When called inside an active span, the
 * SDK attaches trace_id + span_id automatically.
 */
export function logEvalContent(
	name: string,
	body: string | Record<string, unknown>,
	attributes?: Record<string, string | number | boolean>,
): void {
	// AnyValue requires plain primitives/arrays/records — stringify objects so
	// Dash0 ingests the content as a single searchable log body rather than a
	// nested structure.
	const bodyText = typeof body === "string" ? body : JSON.stringify(body);
	getEvalLogger().emit({
		severityNumber: SeverityNumber.INFO,
		severityText: "INFO",
		body: bodyText,
		attributes: { "eval.event": name, ...(attributes ?? {}) },
	});
}

/**
 * Flush and shut down the active providers (traces + logs). Call this
 * before `process.exit()` in detached processes so batched signals are
 * not lost. No-op if neither provider is active.
 */
export async function shutdownEvalOtel(): Promise<void> {
	const tasks: Promise<unknown>[] = [];
	if (activeProvider) {
		tasks.push(activeProvider.forceFlush().then(() => activeProvider?.shutdown()));
	}
	if (activeLoggerProvider) {
		tasks.push(activeLoggerProvider.forceFlush().then(() => activeLoggerProvider?.shutdown()));
	}
	try {
		await Promise.all(tasks);
	} catch {
		// shutdown is best-effort
	} finally {
		activeProvider = null;
		activeLoggerProvider = null;
	}
}

/**
 * Test hook: reset the module's state AND the global OTel API so each test
 * starts fresh. Not part of the public API.
 */
export function __resetEvalOtelForTests(): void {
	// Tear down any providers left over from a previous test. This
	// un-registers from the global OTel API so `trace.getTracer()` /
	// `logs.getLogger()` fall back to no-op until re-registered.
	if (activeProvider) {
		void activeProvider.shutdown().catch(() => {});
	}
	if (activeLoggerProvider) {
		void activeLoggerProvider.shutdown().catch(() => {});
	}
	activeProvider = null;
	activeLoggerProvider = null;
	trace.disable();
	logs.disable();
}
