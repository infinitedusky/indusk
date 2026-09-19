import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * What the evaluator exports, captured at the wire (day-monitor, Test Phase 1).
 *
 * A2 and A3 are about what a person with the raw trace can read, so the test
 * reads the exported OTLP payload — not an in-process span object, and not
 * InDusk code. The evaluator runs detached, spawned by the eval hook, and
 * exports through `@opentelemetry/exporter-trace-otlp-http`, which posts
 * OTLP/JSON; this server accepts that and nothing else. A protobuf body is
 * recorded as a refusal rather than skipped, so a changed exporter shows up as
 * a failure instead of as "no spans".
 *
 * The fake `claude` stands in for the inner model call. `bad-model` reproduces
 * the real CLI's answer to a model that does not exist, verified 2026-09-18:
 * exit 1, the message on **stdout**, stderr empty.
 */

export const BAD_MODEL_MESSAGE =
	"There's an issue with the selected model (claude-does-not-exist-9). It may not exist or you may not have access to it.";

export interface CapturedSpan {
	service: string;
	traceId: string;
	spanId: string;
	parentSpanId: string;
	name: string;
	/** Raw attribute values, flattened from OTLP's `{ key, value: { stringValue } }`. */
	attributes: Record<string, unknown>;
	events: { name: string; attributes: Record<string, unknown> }[];
}

export interface OtlpCapture {
	/** `http://127.0.0.1:<port>` — set as `OTEL_EXPORTER_OTLP_ENDPOINT`. */
	endpoint: string;
	spans: () => CapturedSpan[];
	/** Bodies the server could not read as OTLP/JSON, with their content type. */
	refused: () => string[];
	/** Resolve once at least `count` spans arrived; throws after `timeoutMs`. */
	waitForSpans: (count: number, timeoutMs?: number) => Promise<CapturedSpan[]>;
	close: () => Promise<void>;
}

type OtlpValue = {
	stringValue?: string;
	intValue?: string | number;
	doubleValue?: number;
	boolValue?: boolean;
	arrayValue?: { values?: OtlpValue[] };
};

function flatten(value: OtlpValue | undefined): unknown {
	if (!value) return undefined;
	if (value.stringValue !== undefined) return value.stringValue;
	if (value.intValue !== undefined) return Number(value.intValue);
	if (value.doubleValue !== undefined) return value.doubleValue;
	if (value.boolValue !== undefined) return value.boolValue;
	if (value.arrayValue) return (value.arrayValue.values ?? []).map(flatten);
	return undefined;
}

function attrs(list: { key: string; value?: OtlpValue }[] | undefined): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const a of list ?? []) out[a.key] = flatten(a.value);
	return out;
}

interface OtlpBody {
	resourceSpans?: {
		resource?: { attributes?: { key: string; value?: OtlpValue }[] };
		scopeSpans?: {
			spans?: {
				traceId: string;
				spanId: string;
				parentSpanId?: string;
				name: string;
				attributes?: { key: string; value?: OtlpValue }[];
				events?: { name: string; attributes?: { key: string; value?: OtlpValue }[] }[];
			}[];
		}[];
	}[];
}

export async function startOtlpCapture(): Promise<OtlpCapture> {
	const captured: CapturedSpan[] = [];
	const refused: string[] = [];

	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (c: Buffer) => chunks.push(c));
		req.on("end", () => {
			const type = req.headers["content-type"] ?? "";
			if (req.url?.startsWith("/v1/traces")) {
				if (!type.includes("json")) {
					refused.push(type);
				} else {
					const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as OtlpBody;
					for (const rs of body.resourceSpans ?? []) {
						const service = String(attrs(rs.resource?.attributes)["service.name"] ?? "");
						for (const ss of rs.scopeSpans ?? []) {
							for (const s of ss.spans ?? []) {
								captured.push({
									service,
									traceId: s.traceId,
									spanId: s.spanId,
									parentSpanId: s.parentSpanId ?? "",
									name: s.name,
									attributes: attrs(s.attributes),
									events: (s.events ?? []).map((e) => ({
										name: e.name,
										attributes: attrs(e.attributes),
									})),
								});
							}
						}
					}
				}
			}
			// Logs and anything else: accept and drop.
			res.writeHead(200, { "content-type": "application/json" });
			res.end("{}");
		});
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const { port } = server.address() as AddressInfo;

	return {
		endpoint: `http://127.0.0.1:${port}`,
		spans: () => [...captured],
		refused: () => [...refused],
		waitForSpans: async (count, timeoutMs = 30_000) => {
			const deadline = Date.now() + timeoutMs;
			while (captured.length < count) {
				if (Date.now() > deadline) {
					throw new Error(
						`otlp-capture: ${captured.length} span(s) after ${timeoutMs}ms, wanted ${count}${refused.length ? `; refused bodies: ${refused.join(", ")}` : ""}`,
					);
				}
				await new Promise((r) => setTimeout(r, 200));
			}
			return [...captured];
		},
		close: () => new Promise<void>((r) => server.close(() => r())),
	};
}

export type FakeClaudeMode = "bad-model" | "scorecard";

/**
 * A directory holding an executable `claude` for `mode`. Prepend it to `PATH`.
 * `scorecard` answers the way `claude -p --output-format json` does, with a
 * minimal valid scorecard as its result.
 */
export function fakeClaudeDir(mode: FakeClaudeMode): string {
	const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
	mkdirSync(dir, { recursive: true });
	const script =
		mode === "bad-model"
			? `#!/bin/sh\ncat > /dev/null\necho "${BAD_MODEL_MESSAGE}"\nexit 1\n`
			: `#!/bin/sh\ncat > /dev/null\ncat <<'JSON'\n${JSON.stringify({
					result: JSON.stringify({
						version: 1,
						timestamp: "2026-09-18T00:00:00.000Z",
						mode: "eval",
						changeId: "fixture",
						projectGroup: "fixture",
						questions: [],
						summary: "fixture scorecard",
					}),
					session_id: "fixture-session",
					total_cost_usd: 0,
					usage: { input_tokens: 1, output_tokens: 1 },
					duration_ms: 1,
				})}\nJSON\nexit 0\n`;
	const path = join(dir, "claude");
	writeFileSync(path, script);
	chmodSync(path, 0o755);
	return dir;
}
