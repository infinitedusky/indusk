// clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable
// promise: the-daemon-readers-follow-is-the-one-running
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A23 — the shipped Jaeger with the config InDusk renders writes no line of
 * failing to send its own traces over half a minute, while traces and logs
 * sent to it still arrive.
 *
 * Jaeger traces itself by default (its query handlers, so the check polls the
 * interface as a reader does) and exports to :4317, where nothing listens; on 2026-10-16 that was 67 % of the daemon's log. A line counts when
 * it names :4317 and either the trace exporter or the failed connection.
 *
 * System tier: it runs a real Jaeger and otelcol for thirty seconds.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

const WATCH_MS = 30_000;
const EVERY_MS = 5_000;

interface Meta {
	jaegerPid: number;
	otelcolPid: number;
	otlpPort: number;
	uiPort: number;
	logsOtlpPort: number;
}

let home: string;
let pids: number[] = [];

function cli(args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		env: { ...process.env, INDUSK_HOME: home },
		encoding: "utf-8",
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

async function post(url: string, body: unknown): Promise<number> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	return res.status;
}

function traceBody(n: number): unknown {
	const now = BigInt(Date.now()) * 1_000_000n;
	return {
		resourceSpans: [
			{
				resource: {
					attributes: [{ key: "service.name", value: { stringValue: "self-tracing-a23" } }],
				},
				scopeSpans: [
					{
						spans: [
							{
								traceId: `5b8efff798038103d269b633813f${String(1000 + n)}`,
								spanId: `eee19b7ec3c1${String(1000 + n)}`,
								name: "probe",
								kind: 1,
								startTimeUnixNano: String(now),
								endTimeUnixNano: String(now + 1_000_000n),
							},
						],
					},
				],
			},
		],
	};
}

function logBody(n: number): unknown {
	return {
		resourceLogs: [
			{
				resource: {
					attributes: [{ key: "service.name", value: { stringValue: "self-tracing-a23" } }],
				},
				scopeLogs: [
					{
						logRecords: [
							{
								timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
								severityText: "INFO",
								body: { stringValue: `self-tracing-probe-${n}` },
							},
						],
					},
				],
			},
		],
	};
}

beforeAll(() => {
	if (!SHOULD_SKIP) home = mkdtempSync(join(tmpdir(), "self-tracing-"));
});

afterAll(() => {
	if (SHOULD_SKIP) return;
	cli(["telemetry", "stop"]);
	for (const pid of pids) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// already gone
		}
	}
	rmSync(home, { recursive: true, force: true });
});

describe("the daemon's log holds no Jaeger tracing itself", () => {
	it.skipIf(SHOULD_SKIP)(
		"no self-tracing line in half a minute, while a trace and a log record still arrive",
		async () => {
			const start = cli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(start.code, start.stderr || start.stdout).toBe(0);
			const meta = JSON.parse(readFileSync(join(home, "telemetry.json"), "utf-8")) as Meta;
			pids = [meta.jaegerPid, meta.otelcolPid];

			let logStatus = 0;
			const rounds = WATCH_MS / EVERY_MS;
			for (let n = 0; n < rounds; n++) {
				const t = await post(`http://127.0.0.1:${meta.otlpPort}/v1/traces`, traceBody(n));
				expect(t).toBe(200);
				// Jaeger traces its own query handlers: a reader polling the interface is what makes it export.
				await fetch(`http://127.0.0.1:${meta.uiPort}/api/services`);
				logStatus = await post(`http://127.0.0.1:${meta.logsOtlpPort}/v1/logs`, logBody(n));
				await new Promise((r) => setTimeout(r, EVERY_MS));
			}

			const log = readFileSync(join(home, "telemetry.log"), "utf-8").split("\n");
			const selfTracing = log.filter(
				(l) => l.includes("4317") && /traces export|addrConn\.createTransport failed/.test(l),
			);
			expect(selfTracing, "lines of Jaeger failing to send its own traces").toEqual([]);

			const services = (await (
				await fetch(`http://127.0.0.1:${meta.uiPort}/api/services`)
			).json()) as { data?: string[] };
			expect(services.data, "the posted trace is in the interface").toContain("self-tracing-a23");
			expect(logStatus).toBeGreaterThanOrEqual(200);
			expect(logStatus).toBeLessThan(300);
		},
		120_000,
	);
});
