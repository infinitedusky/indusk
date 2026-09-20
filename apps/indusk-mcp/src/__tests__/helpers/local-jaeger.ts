import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * A real local Jaeger for the monitor's tests (day-monitor, Test Phase 1).
 *
 * The monitor reads Jaeger's query API, so a stub of that API would test our
 * reading of our own guess at it. This starts the local-telemetry extension's
 * own daemon — the same binaries and config `indusk telemetry start` uses — in
 * an `INDUSK_HOME` the caller owns, on free ports, and loads fixture spans
 * into it over OTLP/HTTP. `indusk promises status` then finds the daemon the
 * way it does on a developer's machine: through `$INDUSK_HOME/telemetry.json`.
 *
 * Self-contained (node built-ins only) so the admin's HTTP tests import it by
 * path rather than carrying a copy: test helpers are not package exports, and
 * one copy of "how a test starts Jaeger" is the only number that cannot drift.
 *
 * Throws when the daemon cannot start or a load is refused — a helper that
 * degrades lets "not seen" pass for a Jaeger that was never there.
 */

const REPO_ROOT = resolve(__dirname, "../../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

export interface FixtureSpan {
	service: string;
	name: string;
	/** Sets `indusk.promise` — the ADR D1 mark. */
	promise?: string;
	/** Sets `indusk.promise.outcome`. */
	outcome?: "upheld" | "violated";
	/** With `outcome: "violated"`, the `indusk.promise.violated` event's symptom. */
	symptom?: string;
	/** When the span ended. Default: now. */
	at?: Date;
	/** Reuse a trace id (several spans in one trace). Default: a fresh one. */
	traceId?: string;
	attributes?: Record<string, string | number | boolean>;
	/**
	 * Attributes on the **resource** rather than the span — where
	 * `deployment.environment` actually lives for a conventionally
	 * instrumented application, and where A21 found the reader was not
	 * looking. Spans sharing a service must agree; the first wins.
	 */
	resourceAttributes?: Record<string, string | number | boolean>;
}

export interface LocalJaeger {
	home: string;
	otlpPort: number;
	uiPort: number;
	/** `http://localhost:<uiPort>` — where the query API answers. */
	queryUrl: string;
	/**
	 * Export spans over OTLP/HTTP JSON; resolves with their trace ids once Jaeger
	 * returns them. `waitFor: "last"` waits on the last trace only — for a bulk
	 * load, where polling each of thousands of traces is the slow part.
	 */
	load: (spans: FixtureSpan[], opts?: { waitFor?: "all" | "last" }) => Promise<string[]>;
	/** Stop the daemon. Safe to call twice. */
	stop: () => void;
}

export function newTraceId(): string {
	return randomBytes(16).toString("hex");
}

function attr(key: string, value: string | number | boolean) {
	if (typeof value === "string") return { key, value: { stringValue: value } };
	if (typeof value === "boolean") return { key, value: { boolValue: value } };
	return Number.isInteger(value)
		? { key, value: { intValue: String(value) } }
		: { key, value: { doubleValue: value } };
}

function nanos(d: Date): string {
	// BigInt() rather than a literal: the admin imports this file and compiles at ES2017.
	return (BigInt(d.getTime()) * BigInt(1_000_000)).toString();
}

/** The OTLP/JSON body for `spans`, grouped by service. Exported for the capture tests. */
export function otlpBody(spans: FixtureSpan[]): { body: unknown; traceIds: string[] } {
	const byService = new Map<string, unknown[]>();
	const traceIds: string[] = [];
	for (const s of spans) {
		const end = s.at ?? new Date();
		const start = new Date(end.getTime() - 5);
		const traceId = s.traceId ?? newTraceId();
		traceIds.push(traceId);
		const attributes = Object.entries(s.attributes ?? {}).map(([k, v]) => attr(k, v));
		if (s.promise !== undefined) attributes.push(attr("indusk.promise", s.promise));
		if (s.outcome !== undefined) attributes.push(attr("indusk.promise.outcome", s.outcome));
		const events =
			s.outcome === "violated"
				? [
						{
							timeUnixNano: nanos(end),
							name: "indusk.promise.violated",
							attributes: s.symptom ? [attr("indusk.promise.symptom", s.symptom)] : [],
						},
					]
				: [];
		const span = {
			traceId,
			spanId: randomBytes(8).toString("hex"),
			name: s.name,
			kind: 1,
			startTimeUnixNano: nanos(start),
			endTimeUnixNano: nanos(end),
			attributes,
			events,
			status: {},
		};
		const list = byService.get(s.service) ?? [];
		list.push(span);
		byService.set(s.service, list);
	}
	const body = {
		resourceSpans: [...byService.entries()].map(([service, list]) => ({
			resource: {
				attributes: [
					attr("service.name", service),
					...Object.entries(spans.find((s) => s.service === service)?.resourceAttributes ?? {}).map(
						([k, v]) => attr(k, v),
					),
				],
			},
			scopeSpans: [{ scope: { name: "day-monitor-fixture" }, spans: list }],
		})),
	};
	return { body, traceIds };
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Start the daemon in `home` (default: a fresh temp dir). The caller owns the
 * home; `stop()` stops the daemon and leaves the directory.
 */
export async function startLocalJaeger(opts: { home?: string } = {}): Promise<LocalJaeger> {
	if (!existsSync(CLI_BIN)) {
		throw new Error(`startLocalJaeger: the CLI is not built at ${CLI_BIN}`);
	}
	const home = opts.home ?? mkdtempSync(join(tmpdir(), "indusk-jaeger-home-"));
	const env = { ...process.env, INDUSK_HOME: home, INDUSK_SKIP_UPDATE_CHECK: "1" };
	const started = spawnSync(
		"node",
		[CLI_BIN, "telemetry", "start", "--otlp-port", "0", "--ui-port", "0"],
		{ env, encoding: "utf-8" },
	);
	const metaPath = join(home, "telemetry.json");
	if (started.status !== 0 || !existsSync(metaPath)) {
		throw new Error(
			`startLocalJaeger: telemetry start failed (exit ${started.status}): ${started.stderr}${started.stdout}`,
		);
	}
	const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { otlpPort: number; uiPort: number };
	const queryUrl = `http://localhost:${meta.uiPort}`;

	let stopped = false;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		spawnSync("node", [CLI_BIN, "telemetry", "stop"], { env, encoding: "utf-8" });
	};

	const load = async (
		spans: FixtureSpan[],
		opts: { waitFor?: "all" | "last" } = {},
	): Promise<string[]> => {
		const { body, traceIds } = otlpBody(spans);
		const res = await fetch(`http://localhost:${meta.otlpPort}/v1/traces`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			throw new Error(
				`startLocalJaeger.load: OTLP export refused (${res.status}): ${await res.text()}`,
			);
		}
		// Jaeger batches before storing; wait until every trace is queryable.
		const deadline = Date.now() + 15_000;
		const waitOn = opts.waitFor === "last" ? traceIds.slice(-1) : [...new Set(traceIds)];
		for (const id of waitOn) {
			for (;;) {
				const r = await fetch(`${queryUrl}/api/traces/${id}`).catch(() => null);
				if (r?.ok) {
					const json = (await r.json()) as { data?: unknown[] };
					if (json.data && json.data.length > 0) break;
				}
				if (Date.now() > deadline) {
					throw new Error(`startLocalJaeger.load: trace ${id} never became queryable`);
				}
				await sleep(200);
			}
		}
		return traceIds;
	};

	return { home, otlpPort: meta.otlpPort, uiPort: meta.uiPort, queryUrl, load, stop };
}

export interface FakeQueryPort {
	port: number;
	close: () => Promise<void>;
}

/**
 * Something that is not Jaeger, answering on the port the daemon record in
 * `home` names (day-monitor A26). The record's identity check passes — both
 * recorded PIDs are this process's, and the stub listens on every recorded
 * port — so a reader gets as far as the query and meets `body` with a 200.
 *
 * The stub answers from the calling process: a CLI run against it must be
 * spawned asynchronously, since `spawnSync` would block the answer.
 */
export async function startFakeQueryPort(
	home: string,
	body = "<html>not jaeger</html>",
): Promise<FakeQueryPort> {
	const { createServer } = await import("node:http");
	const { writeFileSync } = await import("node:fs");
	const server = createServer((_req, res) => {
		res.writeHead(200, { "content-type": "text/html" });
		res.end(body);
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const port = (server.address() as import("node:net").AddressInfo).port;
	writeFileSync(join(home, "telemetry.pid"), String(process.pid));
	writeFileSync(
		join(home, "telemetry.json"),
		JSON.stringify({
			jaegerPid: process.pid,
			otelcolPid: process.pid,
			otlpPort: port,
			uiPort: port,
			mcpPort: port,
			jaegerHealthPort: port,
			otelcolHealthPort: port,
			logsOtlpPort: port,
			startedAt: new Date().toISOString(),
		}),
	);
	return { port, close: () => new Promise<void>((r) => server.close(() => r())) };
}
