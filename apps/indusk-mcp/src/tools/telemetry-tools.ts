import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Telemetry MCP tools registered under the `local-telemetry` extension.
 *
 * v1 registers a single CUSTOM tool: `tail_logs`. Trace-side tools
 * (`search_traces`, `get_trace_topology`, `get_span_details`,
 * `get_critical_path`, `get_trace_errors`, `get_services`, `get_span_names`,
 * `get_trace_topology`, `health`) are served directly by Jaeger's bundled
 * `jaeger_mcp` extension, wired into the project's `.mcp.json` by
 * `indusk telemetry register` as an `http` MCP server at the daemon's
 * current `mcpPort`. The agent uses Jaeger's MCP for traces, indusk-mcp's
 * MCP for logs.
 *
 * A future `unified-telemetry-query` plan will replace this split with
 * one natural-language interface that dispatches to either Jaeger or Dash0
 * under the hood — but until then, ship the direct-connection shape.
 */

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

function telemetryRegistryPath(): string {
	return join(induskHome(), "telemetry", "projects.json");
}

function logsPath(): string {
	return join(induskHome(), "telemetry", "logs.jsonl");
}

/**
 * Is the local-telemetry daemon registered for at least one project?
 * Used to gate whether to register telemetry tools at all — if nobody's
 * using the extension, the tools don't need to be surfaced.
 */
function isTelemetryActive(): boolean {
	const p = telemetryRegistryPath();
	if (!existsSync(p)) return false;
	try {
		const reg = JSON.parse(readFileSync(p, "utf-8")) as {
			projects?: unknown[];
		};
		return Array.isArray(reg.projects) && reg.projects.length > 0;
	} catch {
		return false;
	}
}

interface RawLogRecord {
	[k: string]: unknown;
}

/**
 * Best-effort parse of an otelcol file-exporter JSONL line. The exporter's
 * output shape is an OTLP LogsData JSON envelope per line; we pluck
 * commonly-useful fields into a flat record. Non-LogRecord lines (e.g.,
 * empty, malformed partial writes from a rotating write) are skipped.
 */
interface NormalizedLog {
	timestamp: string;
	service: string | null;
	level: string | null;
	body: string;
	trace_id: string | null;
	span_id: string | null;
	attributes: Record<string, unknown>;
}

function normalizeLog(raw: RawLogRecord): NormalizedLog[] {
	// otelcol file exporter writes one OTLP envelope per line:
	// { resourceLogs: [ { resource: {...}, scopeLogs: [ { logRecords: [ {...} ] } ] } ] }
	const out: NormalizedLog[] = [];
	const resourceLogs = Array.isArray(raw.resourceLogs) ? raw.resourceLogs : [];
	for (const rl of resourceLogs) {
		if (!rl || typeof rl !== "object") continue;
		const rlObj = rl as Record<string, unknown>;
		const resource = (rlObj.resource ?? {}) as Record<string, unknown>;
		const resourceAttrs = pickAttributes((resource.attributes ?? []) as unknown[]);
		const service =
			typeof resourceAttrs["service.name"] === "string"
				? (resourceAttrs["service.name"] as string)
				: null;
		const scopeLogs = Array.isArray(rlObj.scopeLogs) ? rlObj.scopeLogs : [];
		for (const sl of scopeLogs) {
			if (!sl || typeof sl !== "object") continue;
			const slObj = sl as Record<string, unknown>;
			const logRecords = Array.isArray(slObj.logRecords) ? slObj.logRecords : [];
			for (const lr of logRecords) {
				if (!lr || typeof lr !== "object") continue;
				const lrObj = lr as Record<string, unknown>;
				const attrs = pickAttributes((lrObj.attributes ?? []) as unknown[]);
				const bodyObj = (lrObj.body ?? {}) as Record<string, unknown>;
				const body =
					typeof bodyObj.stringValue === "string"
						? (bodyObj.stringValue as string)
						: JSON.stringify(bodyObj);
				const timeNs =
					typeof lrObj.timeUnixNano === "string"
						? Number(lrObj.timeUnixNano)
						: typeof lrObj.timeUnixNano === "number"
							? lrObj.timeUnixNano
							: Date.now() * 1_000_000;
				out.push({
					timestamp: new Date(timeNs / 1_000_000).toISOString(),
					service,
					level:
						typeof lrObj.severityText === "string"
							? (lrObj.severityText as string).toLowerCase()
							: null,
					body,
					trace_id: typeof lrObj.traceId === "string" ? (lrObj.traceId as string) : null,
					span_id: typeof lrObj.spanId === "string" ? (lrObj.spanId as string) : null,
					attributes: { ...resourceAttrs, ...attrs },
				});
			}
		}
	}
	return out;
}

function pickAttributes(list: unknown[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const a of list) {
		if (!a || typeof a !== "object") continue;
		const aObj = a as Record<string, unknown>;
		const key = typeof aObj.key === "string" ? aObj.key : null;
		if (!key) continue;
		const value = aObj.value as Record<string, unknown> | undefined;
		if (!value) continue;
		if (typeof value.stringValue === "string") out[key] = value.stringValue;
		else if (typeof value.intValue === "string") out[key] = Number(value.intValue);
		else if (typeof value.intValue === "number") out[key] = value.intValue;
		else if (typeof value.boolValue === "boolean") out[key] = value.boolValue;
		else if (typeof value.doubleValue === "number") out[key] = value.doubleValue;
		else out[key] = value;
	}
	return out;
}

const TailLogsInput = z.object({
	service: z
		.string()
		.optional()
		.describe(
			"Only return logs from this service (matches resource attribute service.name). Omit to include all services.",
		),
	level: z
		.enum(["error", "warn", "info", "debug", "any"])
		.default("any")
		.describe("Only return logs at this severity or worse. `any` returns all levels."),
	since_minutes: z
		.number()
		.int()
		.min(1)
		.max(240)
		.default(5)
		.describe("How far back to look. Clamped to [1, 240] minutes."),
	limit: z
		.number()
		.int()
		.min(1)
		.max(200)
		.default(50)
		.describe(
			"Maximum number of log records to return. Hard cap 200. Response includes `truncated: true` when this cap is hit.",
		),
});

const LEVEL_RANK: Record<string, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export function registerTelemetryTools(server: McpServer): void {
	// Don't register telemetry tools unless the local-telemetry daemon
	// has at least one registered project — no point surfacing tools that
	// will always return empty.
	if (!isTelemetryActive()) return;

	server.registerTool(
		"tail_logs",
		{
			description:
				"Return recent log records from the local-telemetry daemon's log sink. Use this for 'what did the server say around the time of this failure?' diagnosis. Logs come from otelcol's file exporter — structured OTLP logs with service name, severity, trace_id, span_id, and attributes. Filter by service, severity level, and time window.",
			inputSchema: TailLogsInput.shape,
		},
		async (rawInput) => {
			const input = TailLogsInput.parse(rawInput);
			const path = logsPath();
			if (!existsSync(path)) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									entries: [],
									count: 0,
									truncated: false,
									window_actual: {
										from: new Date(Date.now() - input.since_minutes * 60_000).toISOString(),
										to: new Date().toISOString(),
									},
									hints: [
										"No log sink file found — either no logs have been emitted yet, or the daemon isn't running. Check `indusk telemetry status`.",
									],
								},
								null,
								2,
							),
						},
					],
				};
			}

			const windowStart = Date.now() - input.since_minutes * 60_000;
			const minRank = input.level === "any" ? -1 : (LEVEL_RANK[input.level] ?? -1);

			const raw = readFileSync(path, "utf-8");
			const matches: NormalizedLog[] = [];
			let truncated = false;

			for (const line of raw.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				let parsed: RawLogRecord;
				try {
					parsed = JSON.parse(trimmed);
				} catch {
					continue;
				}
				const records = normalizeLog(parsed);
				for (const rec of records) {
					const recTime = new Date(rec.timestamp).getTime();
					if (recTime < windowStart) continue;
					if (input.service && rec.service !== input.service) continue;
					if (minRank >= 0) {
						const rank = LEVEL_RANK[rec.level ?? ""] ?? -1;
						if (rank < minRank) continue;
					}
					matches.push(rec);
					if (matches.length > input.limit) {
						truncated = true;
						matches.pop();
						break;
					}
				}
				if (truncated) break;
			}

			matches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

			const hints: string[] = [];
			if (matches.length === 0) {
				hints.push(
					"No matching log records. Widen the window via `since_minutes` or drop the `service`/`level` filter.",
				);
			} else {
				const errorCount = matches.filter((m) => m.level === "error").length;
				if (errorCount > 0 && input.level !== "error") {
					hints.push(
						`${errorCount} error-level record(s) in this window — consider calling tail_logs again with level="error" to focus on failures.`,
					);
				}
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								entries: matches,
								count: matches.length,
								truncated,
								window_actual: {
									from: new Date(windowStart).toISOString(),
									to: new Date().toISOString(),
								},
								hints,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
