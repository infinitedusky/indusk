import type { StoredAddress } from "../../lib/telemetry/daemon-address.js";
import type { DaemonReads, ProcessRow, RenderedPorts } from "../../lib/telemetry/daemon-reads.js";
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

/** InDusk's own block: the ports the stored address holds when the block is free. */
export const BLOCK: RenderedPorts = {
	otlpPort: 24318,
	logsOtlpPort: 24319,
	uiPort: 24316,
	mcpPort: 24317,
};

/** Process 1 (Jaeger) and 2 (collector) holding the block's ports. */
export const ON_BLOCK: Record<number, number[]> = { 1: [24318, 24316, 24317], 2: [24319] };

export interface FakeReads extends DaemonReads {
	/** Every time the code under test removed the record: only a finder, under the lock, for a record of dead processes. */
	removed: string[];
	/** Every record it wrote. */
	written: { meta: DaemonMeta; exclusive: boolean }[];
	/** Every stored address it wrote. */
	addressWrites: { address: StoredAddress; exclusive: boolean }[];
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
		/** The stored address; none when left out or `null`. */
		address?: StoredAddress | null;
		/** Why the address file cannot be read, when it is there and damaged. */
		addressProblem?: string;
		/**
		 * The rendered config files: the ports they name (the block unless given),
		 * and whether they were written after the daemon's processes started.
		 */
		yaml?: { ports?: RenderedPorts; mtimeAfterStart: boolean };
	} = {},
): FakeReads {
	let record = machine.record ?? null;
	let address = machine.address ?? null;
	const written: FakeReads["written"] = [];
	const removed: string[] = [];
	const addressWrites: FakeReads["addressWrites"] = [];
	return {
		removed,
		written,
		addressWrites,
		address: () => address,
		addressProblem: () => (address === null ? (machine.addressProblem ?? null) : null),
		writeAddress(next, opts) {
			if (opts.exclusive && address !== null) return false;
			address = next;
			addressWrites.push({ address: next, exclusive: opts.exclusive });
			return true;
		},
		record: () => record,
		removeRecord() {
			record = null;
			removed.push("record");
		},
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
		renderedPorts: () => (machine.yaml ? (machine.yaml.ports ?? BLOCK) : null),
		lock: async () => () => {},
		lockSync: () => () => {},
		stat(path) {
			const file = machine.files?.[path];
			if (file) return file;
			const yaml = machine.yaml;
			const row = machine.processes?.find((p) => p.command.includes(path));
			if (!yaml || !row?.startedAt) return null;
			const started = Date.parse(row.startedAt);
			return { mtimeMs: started + (yaml.mtimeAfterStart ? 60_000 : -1_000), size: 1 };
		},
		logSince: () => machine.log ?? [],
		now: () => machine.now ?? Date.parse("2026-10-16T13:00:00.000Z"),
	};
}
