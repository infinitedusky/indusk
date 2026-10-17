// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
// a regression guard over every-commit-evaluated: each evaluation's report reaches the local Jaeger
// promise: the-daemon-readers-follow-is-the-one-running
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evalDir } from "../lib/bookkeeping/roots.js";
import {
	__resetEvalOtelForTests,
	evalLogsEndpoint,
	initEvalOtelLogs,
	shutdownEvalOtel,
} from "../lib/eval/otel.js";
import { resolveLocal } from "../lib/promises/sources.js";
import { resolveLocalDaemonSync, resolveLocalDaemonVia } from "../lib/telemetry/daemon-state.js";
import { liveOtlpEndpointSync } from "../lib/telemetry/status.js";
import {
	BLOCK,
	collectorCmd,
	fakeReads,
	HOME,
	jaegerCmd,
	ON_BLOCK,
	rec,
} from "./helpers/daemon-reads.js";

/**
 * A13 and A28 — every reader of the local daemon asks one resolver, so with
 * the record missing and the daemon running each of them follows the running
 * daemon: the promise reader reads its traces, the evaluator exports to it.
 *
 * Pure units over `DaemonReads`; the stored address arrives in Build Phase 3,
 * so the ports are labelled from a rendered yaml the daemon started after.
 */

function lostDaemon() {
	return fakeReads({
		record: null,
		processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
		listening: ON_BLOCK,
		yaml: { ports: BLOCK, mtimeAfterStart: false },
	});
}

describe("A13 — a reader follows the running daemon when the record is missing", () => {
	it("a reader follows the running daemon when the record is missing", async () => {
		// ports labelled from a trusted yaml: the stored address arrives in Build Phase 3
		const local = await resolveLocal({ reads: lostDaemon(), home: HOME });
		// `resolveLocal` answers with a `MarkSource`: the query side as `endpoint.queryUrl`, the OTLP intake as `intakeUrl`.
		expect(local).toMatchObject({
			endpoint: { queryUrl: "http://localhost:24316" },
			intakeUrl: "http://localhost:24318",
		});
	});

	it("writes the record again, so the next reader needs no finding", async () => {
		const reads = lostDaemon();
		await resolveLocal({ reads, home: HOME });
		expect(reads.record()).toMatchObject({ jaegerPid: 1, otelcolPid: 2, uiPort: 24316 });
	});

	it("with nothing running, fails naming the record's path", async () => {
		await expect(resolveLocal({ reads: fakeReads({ record: null }), home: HOME })).rejects.toThrow(
			/no telemetry daemon is running/,
		);
	});
});

describe("A28 — the evaluator exports to the found daemon", () => {
	let projectRoot: string;
	beforeEach(() => {
		projectRoot = join(
			tmpdir(),
			`readers-follow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
		__resetEvalOtelForTests();
	});
	afterEach(async () => {
		await shutdownEvalOtel();
		__resetEvalOtelForTests();
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("the evaluator exports to the found daemon when the record is missing", () => {
		expect(liveOtlpEndpointSync({ reads: lostDaemon(), home: HOME })).toBe(
			"http://localhost:24318",
		);
	});

	it("writes no no-op-logger line while a daemon runs", () => {
		const saved = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
		Reflect.deleteProperty(process.env, "OTEL_EXPORTER_OTLP_ENDPOINT");
		try {
			initEvalOtelLogs(projectRoot, { reads: lostDaemon(), home: HOME });
		} finally {
			if (saved !== undefined) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = saved;
		}
		const logPath = join(evalDir(projectRoot), "system.log");
		const log = existsSync(logPath) ? readFileSync(logPath, "utf-8") : "";
		expect(log).not.toContain("falling back to no-op logger");
		expect(log).toContain("eval.otel.logs initialized — endpoint: http://localhost:24318");
	});
});

describe("A31 — the evaluator's logs go to the daemon's log channel, never the traces port", () => {
	it("the evaluator's logs go to the logs port, never the traces port", () => {
		expect(
			evalLogsEndpoint({ traces: "http://localhost:24318", logs: "http://localhost:24319" }),
		).toBe("http://localhost:24319/v1/logs");
	});

	it("initialised against a running daemon, the log exporter is told the logs port", () => {
		const projectRoot = join(tmpdir(), `readers-follow-logs-${Date.now()}`);
		mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
		__resetEvalOtelForTests();
		const saved = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
		Reflect.deleteProperty(process.env, "OTEL_EXPORTER_OTLP_ENDPOINT");
		try {
			initEvalOtelLogs(projectRoot, { reads: lostDaemon(), home: HOME });
		} finally {
			if (saved !== undefined) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = saved;
		}
		const log = readFileSync(join(evalDir(projectRoot), "system.log"), "utf-8");
		expect(log).toContain("logs: http://localhost:24319/v1/logs");
		rmSync(projectRoot, { recursive: true, force: true });
	});
});

describe("A41 — a reader reaches the recorded Jaeger while its collector is gone", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
	const halfRunning = () =>
		fakeReads({
			record: rec(1, 2),
			processes: [jaegerCmd(1, HOME)],
			listening: { 1: [24318, 24316, 24317] },
		});

	it("the promise reader reaches the Jaeger through the record", async () => {
		const local = await resolveLocal({ reads: halfRunning(), home: HOME });
		expect(local).toMatchObject({
			endpoint: { queryUrl: "http://localhost:24316" },
			intakeUrl: "http://localhost:24318",
		});
	});

	it("the resolver says it reached the daemon through the record, async and sync", async () => {
		const reached = await resolveLocalDaemonVia({ reads: halfRunning(), home: HOME });
		expect(reached).toMatchObject({ via: "record", meta: { jaegerPid: 1, otlpPort: 24318 } });
		expect(resolveLocalDaemonSync({ reads: halfRunning(), home: HOME })).toMatchObject({
			jaegerPid: 1,
			otlpPort: 24318,
		});
		expect(liveOtlpEndpointSync({ reads: halfRunning(), home: HOME })).toBe(
			"http://localhost:24318",
		);
	});

	it("a reader reports no daemon when the recorded Jaeger is gone, whatever else runs", async () => {
		const collectorOnly = fakeReads({
			record: rec(1, 2),
			processes: [collectorCmd(2, HOME)],
			listening: { 2: [24319] },
		});
		await expect(resolveLocal({ reads: collectorOnly, home: HOME })).rejects.toThrow(
			/no telemetry daemon is running/,
		);
		expect(resolveLocalDaemonSync({ reads: collectorOnly, home: HOME })).toBeNull();
	});
});
