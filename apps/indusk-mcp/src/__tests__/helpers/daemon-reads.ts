import type { DaemonReads, ProcessRow } from "../../lib/telemetry/daemon-reads.js";
import type { DaemonMeta } from "../../lib/telemetry/status.js";

/**
 * A machine as `DaemonReads` shows it, for the functions that decide the
 * daemon's state: a record, a process list, the sockets each process holds.
 * Every write is kept so a test can say what a read did not do.
 */

export const HOME = "/home/test/.indusk";
const INSTALL =
	"/x/node_modules/@infinitedusky/indusk-mcp/node_modules/@infinitedusky/telemetry-binaries-darwin-arm64";
export const GLOBAL =
	"/usr/local/lib/node_modules/@infinitedusky/indusk-mcp/node_modules/@infinitedusky/telemetry-binaries-darwin-arm64";

/** A `ps` row for a Jaeger run out of `home`. */
export function jaegerCmd(
	pid: number,
	home: string,
	opts: { install?: string; startedAt?: string } = {},
): ProcessRow {
	return {
		pid,
		startedAt: opts.startedAt ?? "2026-10-16T12:00:00.000Z",
		command: `${opts.install ?? INSTALL}/bin/jaeger --config=file:${home}/telemetry-jaeger.yaml`,
	};
}

/** A `ps` row for a collector run out of `home`. */
export function collectorCmd(
	pid: number,
	home: string,
	opts: { install?: string; startedAt?: string } = {},
): ProcessRow {
	return {
		pid,
		startedAt: opts.startedAt ?? "2026-10-16T12:00:00.000Z",
		command: `${opts.install ?? INSTALL}/bin/otelcol --config=${home}/telemetry-collector.yaml`,
	};
}

/** A record naming two processes, on InDusk's block unless overridden. */
export function rec(
	jaegerPid: number,
	otelcolPid: number,
	over: Partial<DaemonMeta> = {},
): DaemonMeta {
	return {
		jaegerPid,
		otelcolPid,
		otlpPort: 24318,
		uiPort: 24316,
		mcpPort: 24317,
		jaegerHealthPort: 55001,
		otelcolHealthPort: 55002,
		logsOtlpPort: 24319,
		startedAt: "2026-10-16T12:00:00.000Z",
		jaegerBinary: `${INSTALL}/bin/jaeger`,
		otelcolBinary: `${INSTALL}/bin/otelcol`,
		platform: "darwin-arm64",
		logsPath: `${HOME}/telemetry/logs.jsonl`,
		...over,
	};
}

export interface FakeReads extends DaemonReads {
	/** Every record the code under test removed: none, since a read never removes one. */
	removed: string[];
	/** Every record it wrote. */
	written: { meta: DaemonMeta; exclusive: boolean }[];
}

export function fakeReads(
	machine: {
		record?: DaemonMeta | null;
		processes?: ProcessRow[];
		listening?: Record<number, number[]>;
		holders?: Record<number, { pid: number; command: string } | null>;
		files?: Record<string, { mtimeMs: number; size: number }>;
		log?: string[];
		now?: number;
	} = {},
): FakeReads {
	let record = machine.record ?? null;
	const written: FakeReads["written"] = [];
	return {
		removed: [],
		written,
		record: () => record,
		writeRecord(meta, opts) {
			if (opts.exclusive && record !== null) return false;
			record = meta;
			written.push({ meta, exclusive: opts.exclusive });
			return true;
		},
		processes: () => machine.processes ?? [],
		listening: (pids) =>
			Object.fromEntries(pids.map((pid) => [pid, machine.listening?.[pid] ?? []])),
		holders: (ports) => Object.fromEntries(ports.map((p) => [p, machine.holders?.[p] ?? null])),
		stat: (path) => machine.files?.[path] ?? null,
		logSince: () => machine.log ?? [],
		now: () => machine.now ?? Date.parse("2026-10-16T13:00:00.000Z"),
	};
}
