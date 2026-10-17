import {
	type AddressRole,
	portDifferences,
	ROLE_LABEL,
	type StoredAddress,
} from "./daemon-address.js";
import { findDaemon, findDaemonSync } from "./daemon-find.js";
import {
	type DaemonProcess,
	daemonProcessOf,
	homeKind,
	isOwn,
	type OwnProcess,
	ownProcess,
	realTempRoots,
} from "./daemon-process.js";
import type { DaemonReads } from "./daemon-reads.js";
import type { DaemonMeta } from "./status.js";

/**
 * Whether the local telemetry daemon is running, from reads alone.
 *
 * Plain functions over `DaemonReads`: the record names two processes, the
 * process list says what those pids are now, and a process is InDusk's daemon
 * by its command line (`daemonProcessOf`), never by a port answering. A port
 * that is slow is still a running daemon; a record whose processes are gone is
 * named and left where it is, for `start` to write over and `stop` to remove.
 * Nothing here writes or removes the record.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export type DaemonStateKind =
	/** The record names both processes and both are InDusk's. */
	| "running"
	/** The record names two processes and only one is still the daemon. */
	| "partial"
	/** No record, or one naming only dead processes, while this home's daemon processes run. */
	| "found"
	/** The record names processes that are gone, or are no longer the daemon. */
	| "stale"
	/** No record and nothing runs. */
	| "none";

export interface DaemonState {
	kind: DaemonStateKind;
	home: string;
	meta: DaemonMeta | null;
	/** Which of the recorded processes is still this home's daemon. */
	recorded: { jaeger: boolean; otelcol: boolean };
	/** This home's daemon processes the record does not name. */
	strays: OwnProcess[];
	/** This home's daemon processes with no record to name them (kind `found`). */
	found: OwnProcess[];
	/** Daemon processes of any home whose config file is gone. */
	orphans: OwnProcess[];
	/** The stored address, or `null` when none is stored. */
	address: StoredAddress | null;
	/** Ports the daemon holds that differ from the stored address. */
	portDifferences: string[];
}

export function daemonState(reads: DaemonReads, home: string): DaemonState {
	const meta = reads.record();
	const daemons = reads.processes().flatMap((row) => {
		const proc = daemonProcessOf(row.command);
		return proc ? [{ row, proc }] : [];
	});
	const ofThisHome = daemons.filter((d) => isOwn(d.proc, home));

	const named = (pid: number, role: DaemonProcess["role"]): boolean =>
		ofThisHome.some((d) => d.row.pid === pid && d.proc.role === role);
	const recorded = {
		jaeger: meta !== null && named(meta.jaegerPid, "jaeger"),
		otelcol: meta !== null && named(meta.otelcolPid, "otelcol"),
	};

	const recordedPids = new Set(meta === null ? [] : [meta.jaegerPid, meta.otelcolPid]);
	const unnamed = ofThisHome.filter((d) => !recordedPids.has(d.row.pid));
	const orphanRows = daemons.filter((d) => reads.stat(d.proc.configPath) === null);
	const listening = reads.listening([
		...new Set([...unnamed, ...orphanRows].map((d) => d.row.pid)),
	]);
	const own = (d: (typeof daemons)[number]): OwnProcess =>
		ownProcess(d.row, d.proc, listening[d.row.pid] ?? []);

	let kind: DaemonStateKind;
	if (meta === null) kind = unnamed.length > 0 ? "found" : "none";
	else if (recorded.jaeger && recorded.otelcol) kind = "running";
	else if (recorded.jaeger || recorded.otelcol) kind = "partial";
	// A record naming only dead processes beside this home's running daemon is a lost record.
	else kind = unnamed.length > 0 ? "found" : "stale";

	// The stored address belongs to the real home: a temporary home never reads one.
	const address = homeKind(home, realTempRoots()) === "real" ? reads.address() : null;
	return {
		kind,
		home,
		meta,
		recorded,
		strays: kind === "found" ? [] : unnamed.map(own),
		found: kind === "found" ? unnamed.map(own) : [],
		orphans: orphanRows.map(own),
		address,
		portDifferences:
			meta !== null && (kind === "running" || kind === "partial")
				? portDifferencesOf(meta, address)
				: [],
	};
}

/** The order status has always listed a record's differing ports in. */
const STATUS_ORDER: readonly AddressRole[] = ["traces", "ui", "mcp", "logs"];

/** Each port the record holds that is not the stored address's, said as `traces on 4318 (expected 24318)`. A port the finder could not read (0) is not a difference. */
function portDifferencesOf(meta: DaemonMeta, address: StoredAddress | null): string[] {
	return portDifferences(meta, address)
		.sort((a, b) => STATUS_ORDER.indexOf(a.role) - STATUS_ORDER.indexOf(b.role))
		.map((d) => `${ROLE_LABEL[d.role]} on ${d.held} (expected ${d.expected})`);
}

/** What one port answered when asked, and how long the asking waited. */
export interface PortAnswer {
	answer: "connected" | "refused" | "timeout";
	waitedMs: number;
}

const RECORDED_PORTS = [
	["OTLP", "otlpPort"],
	["Logs", "logsOtlpPort"],
	["Jaeger UI", "uiPort"],
	["MCP", "mcpPort"],
] as const;

/** The ports a record names, by what each is for. */
export function recordedPorts(meta: DaemonMeta): { name: string; port: number }[] {
	return RECORDED_PORTS.map(([name, key]) => ({ name, port: meta[key] }));
}

function describeStray(p: OwnProcess): string {
	const ports = p.ports.length > 0 ? p.ports.join(", ") : "none";
	return `  ${p.role} ${p.pid}  started ${p.startedAt ?? "at an unknown time"}  ports ${ports}  from ${p.binary}`;
}

/** The lines `indusk telemetry status` prints for a state and what its ports answered. */
export function renderStatus(state: DaemonState, answers: Record<number, PortAnswer>): string[] {
	const lines: string[] = [];
	const { meta } = state;
	switch (state.kind) {
		case "running":
		case "partial": {
			const label = state.kind === "running" ? "running" : "partly running";
			lines.push(`Telemetry daemon: ${label}`);
			if (meta !== null) {
				for (const { name, port } of recordedPorts(meta)) {
					// 0 is a port a finder could not read from a socket: said, never guessed.
					lines.push(
						`  ${`${name}:`.padEnd(11)}${port > 0 ? `http://localhost:${port}` : "unknown (not read from a socket)"}`,
					);
				}
				lines.push(`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`);
				lines.push(`  Started:   ${meta.startedAt}`);
				for (const p of state.address?.picked ?? []) {
					lines.push(
						`  ${ROLE_LABEL[p.role]} port was picked once: ${p.blockPort} was held${p.holder ? ` by ${p.holder}` : ""}`,
					);
				}
				if (state.portDifferences.length > 0) {
					lines.push(
						`  differs from the stored address: ${state.portDifferences.join("; ")}; \`indusk telemetry restart\` brings it onto the stored address`,
					);
				}
				for (const { name, port } of recordedPorts(meta)) {
					const a = port > 0 ? answers[port] : undefined;
					if (a?.answer === "timeout") {
						lines.push(`  ${name}: :${port} did not answer in ${a.waitedMs} ms (slow, not gone)`);
					} else if (a?.answer === "refused") {
						lines.push(`  ${name}: :${port} refused (starting, or that receiver failed)`);
					}
				}
				if (state.kind === "partial") {
					const gone = [
						state.recorded.jaeger ? null : `jaeger ${meta.jaegerPid}`,
						state.recorded.otelcol ? null : `otelcol ${meta.otelcolPid}`,
					].filter(Boolean);
					lines.push(`  gone: ${gone.join(" and ")}; \`indusk telemetry stop\` then \`start\``);
				}
			}
			break;
		}
		case "found":
			lines.push(
				`Telemetry daemon: running, record ${state.meta === null ? "missing" : "names dead processes"} — ${state.found.map((p) => `${p.role} ${p.pid}`).join(" and ")}`,
			);
			break;
		case "stale":
			lines.push("Telemetry daemon: not running");
			if (meta !== null) {
				lines.push(
					`  record names jaeger ${meta.jaegerPid} and otelcol ${meta.otelcolPid}, neither of them the daemon now; kept as it is, \`indusk telemetry start\` writes over it`,
				);
			}
			break;
		case "none":
			lines.push("Telemetry daemon: not running");
			break;
	}
	if (state.strays.length > 0) {
		lines.push(`Strays the record does not name (${state.strays.length}):`);
		for (const p of state.strays) lines.push(describeStray(p));
		lines.push("  `indusk telemetry reap` stops them.");
	}
	return lines;
}

// ---- Jaeger tracing itself ---------------------------------------------------

/**
 * A line of Jaeger failing to send its own traces: it names the port nothing
 * listens on (4317) and either the trace exporter or the failed connection.
 */
const SELF_TRACING =
	/4317.*(?:traces export|addrConn\.createTransport failed)|(?:traces export|addrConn\.createTransport failed).*4317/;

export interface SelfTracing {
	count: number;
	first?: string;
}

/** How many of `lines` are Jaeger failing to trace itself, and the first of them. */
export function selfTracingLines(lines: string[]): SelfTracing {
	const hits = lines.filter((line) => SELF_TRACING.test(line));
	return hits.length === 0 ? { count: 0 } : { count: hits.length, first: hits[0] };
}

/** The self-tracing lines written since the running daemon started: from the offset its record holds, else from its start time. */
export function selfTracingSince(reads: DaemonReads, meta: DaemonMeta): SelfTracing {
	const from =
		meta.logOffset !== undefined
			? { offset: meta.logOffset }
			: { time: Date.parse(meta.startedAt) };
	return selfTracingLines(reads.logSince(from));
}

/** The lines status prints for a self-tracing count: none when Jaeger has not been failing to trace itself. */
export function renderSelfTracing(tracing: SelfTracing): string[] {
	if (tracing.count === 0) return [];
	return [
		`Log: ${tracing.count} line(s) of Jaeger failing to trace itself since the daemon started; first: ${tracing.first}`,
		"  `indusk telemetry restart` starts it with its own tracing off.",
	];
}

// ---- the one resolver every reader of the local daemon calls ----------------

export interface ResolveOpts {
	reads: DaemonReads;
	home: string;
	/** The command asking, named in the finding's report from Build Phase 5. */
	by?: string;
}

/** The record's ports when a reader can reach the daemon through them: the traces and interface ports are known. */
function reachable(meta: DaemonMeta | null): DaemonMeta | null {
	return meta !== null && meta.otlpPort > 0 && meta.uiPort > 0 ? meta : null;
}

/**
 * Whether a reader follows the record: both recorded processes run, or the
 * Jaeger does (traces and the interface are Jaeger's; only logs need the
 * collector, and `status` reports that daemon broken).
 */
const followsRecord = (state: DaemonState): boolean =>
	state.kind === "running" || (state.kind === "partial" && state.recorded.jaeger);

/**
 * The local daemon a reader should reach, or `null` when none runs.
 *
 * Follows the record while it names this home's running daemon; when the
 * record is gone and the daemon runs, finds it (`findDaemon`), which writes
 * the record again. Every reader of the local daemon (promise status and
 * watch, the promise health tool, the admin, the evaluator, `update`, `demo`,
 * `telemetry reset`) asks this, so none of them can disagree. Never starts a
 * daemon and never removes the record.
 */
export async function resolveLocalDaemon(opts: ResolveOpts): Promise<DaemonMeta | null> {
	return (await resolveLocalDaemonVia(opts))?.meta ?? null;
}

/** A daemon a reader reached, and how: through an intact record, or because the record was gone and it was found. */
export interface ReachedDaemon {
	meta: DaemonMeta;
	via: "record" | "found";
}

/** `resolveLocalDaemon`, saying how the daemon was reached, for the reader whose report depends on it. */
export async function resolveLocalDaemonVia(opts: ResolveOpts): Promise<ReachedDaemon | null> {
	const state = daemonState(opts.reads, opts.home);
	if (followsRecord(state)) {
		const meta = reachable(state.meta);
		return meta === null ? null : { meta, via: "record" };
	}
	if (state.kind !== "found") return null;
	const meta = reachable(
		(await findDaemon(opts.reads, opts.home, opts.by ?? "reader"))?.meta ?? null,
	);
	return meta === null ? null : { meta, via: "found" };
}

/** `resolveLocalDaemon` for a synchronous caller: the evaluator decides its exporter at init. */
export function resolveLocalDaemonSync(opts: ResolveOpts): DaemonMeta | null {
	const state = daemonState(opts.reads, opts.home);
	if (followsRecord(state)) return reachable(state.meta);
	if (state.kind !== "found") return null;
	return reachable(findDaemonSync(opts.reads, opts.home, opts.by ?? "reader")?.meta ?? null);
}
