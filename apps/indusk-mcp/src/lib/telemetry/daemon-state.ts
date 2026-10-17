import { type DaemonProcess, daemonProcessOf, isOwn } from "./daemon-process.js";
import type { DaemonReads, ProcessRow } from "./daemon-reads.js";
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

/** A daemon process of this home, as the process list and its sockets show it. */
export interface OwnProcess {
	pid: number;
	role: DaemonProcess["role"];
	binary: string;
	startedAt: string | null;
	ports: number[];
}

export type DaemonStateKind =
	/** The record names both processes and both are InDusk's. */
	| "running"
	/** The record names two processes and only one is still the daemon. */
	| "partial"
	/** No record, but this home's daemon processes run. */
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
	/** Ports the daemon holds that differ from the stored address. */
	portDifferences: string[];
}

function ownProcess(row: ProcessRow, proc: DaemonProcess, ports: number[]): OwnProcess {
	return { pid: row.pid, role: proc.role, binary: proc.binary, startedAt: row.startedAt, ports };
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
	else kind = "stale";

	return {
		kind,
		home,
		meta,
		recorded,
		strays: kind === "found" ? [] : unnamed.map(own),
		found: kind === "found" ? unnamed.map(own) : [],
		orphans: orphanRows.map(own),
		portDifferences: [],
	};
}

/** What one port answered when asked, and how long the asking waited. */
export interface PortAnswer {
	answer: "connected" | "refused" | "timeout";
	waitedMs: number;
}

const RECORDED_PORTS = [
	["OTLP", "otlpPort"],
	["Jaeger UI", "uiPort"],
	["logs", "logsOtlpPort"],
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
					lines.push(`  ${`${name}:`.padEnd(11)}http://localhost:${port}`);
				}
				lines.push(`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`);
				lines.push(`  Started:   ${meta.startedAt}`);
				for (const { name, port } of recordedPorts(meta)) {
					const a = answers[port];
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
				`Telemetry daemon: running, record missing — ${state.found.map((p) => `${p.role} ${p.pid}`).join(" and ")}`,
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
