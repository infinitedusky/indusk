import { JAEGER_DEFAULT_PORTS, type Ports, type StoredAddress } from "./daemon-address.js";
import {
	type DaemonProcess,
	daemonProcessOf,
	isOwn,
	type OwnProcess,
	ownProcess,
} from "./daemon-process.js";
import type { DaemonReads, ProcessRow, RenderedPorts } from "./daemon-reads.js";
import { reportFinding } from "./daemon-reports.js";
import type { DaemonMeta } from "./status.js";

/**
 * Finding a daemon whose record is gone: the processes say what is running,
 * the stored address and the rendered configs say which port is which, and the
 * record is written again from what was found. What the daemon's state is
 * lives in `daemon-state.ts`; this is how a lost one is found.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

/** A rendered config written this long after a process started is still that process's own. */
const YAML_SKEW_MS = 5_000;
/** The collector a Jaeger started, when nothing else pairs them, is the same home's one started this soon after. */
const PAIR_WINDOW_MS = 20_000;

export type FoundRole = "traces" | "ui" | "mcp" | "logs";

export interface Found {
	/** The record: written by this finder, or read back when another command's create won. */
	meta: DaemonMeta;
	/** Roles no socket or trusted config could name; their ports are 0 in `meta`, never guessed. */
	unknownRoles: FoundRole[];
	/** This home's other daemon processes, left for status to list and `reap` to stop. */
	strays: OwnProcess[];
	/** True only for the command whose exclusive create wrote the record. */
	finder: boolean;
}

interface LocatedProcess {
	row: ProcessRow;
	proc: DaemonProcess;
	ports: number[];
	startedMs: number | null;
}

interface Pair {
	jaeger: LocatedProcess;
	otelcol: LocatedProcess;
	ports: RenderedPorts;
}

/** The ports a rendered config may be believed for, given the process that holds the sockets. */
function trustedPorts(
	reads: DaemonReads,
	p: LocatedProcess,
	named: (keyof RenderedPorts)[],
	rendered: RenderedPorts | null,
): RenderedPorts {
	if (rendered === null || p.startedMs === null) return {};
	const written = reads.stat(p.proc.configPath)?.mtimeMs;
	if (written === undefined || written > p.startedMs + YAML_SKEW_MS) return {};
	const claimed = named.flatMap((k) => (rendered[k] === undefined ? [] : [rendered[k] as number]));
	if (claimed.length === 0 || !claimed.every((port) => p.ports.includes(port))) return {};
	return Object.fromEntries(
		named.flatMap((k) => (rendered[k] === undefined ? [] : [[k, rendered[k]]])),
	);
}

/** The roles a process holds a port of the stored address for: the address labels the sockets it names. */
function labelledByAddress(
	address: StoredAddress | null,
	jaeger: LocatedProcess,
	otelcol: LocatedProcess,
): RenderedPorts {
	if (address === null) return {};
	const held = (p: LocatedProcess, port: number): number | undefined =>
		p.ports.includes(port) ? port : undefined;
	const labelled: RenderedPorts = {
		otlpPort: held(jaeger, address.traces),
		uiPort: held(jaeger, address.ui),
		mcpPort: held(jaeger, address.mcp),
		logsOtlpPort: held(otelcol, address.logs),
	};
	return Object.fromEntries(Object.entries(labelled).filter(([, port]) => port !== undefined));
}

function labelPorts(
	reads: DaemonReads,
	jaeger: LocatedProcess,
	otelcol: LocatedProcess,
): RenderedPorts {
	const rendered = reads.renderedPorts();
	const fromAddress = labelledByAddress(reads.address(), jaeger, otelcol);
	const fromYaml: RenderedPorts = {
		...trustedPorts(reads, jaeger, ["otlpPort", "uiPort", "mcpPort", "jaegerHealthPort"], rendered),
		...trustedPorts(reads, otelcol, ["logsOtlpPort", "otelcolHealthPort"], rendered),
	};
	const defaults =
		fromYaml.otlpPort === undefined &&
		fromAddress.otlpPort === undefined &&
		jaeger.ports.includes(JAEGER_DEFAULT_PORTS.traces) &&
		jaeger.ports.includes(JAEGER_DEFAULT_PORTS.ui)
			? { otlpPort: JAEGER_DEFAULT_PORTS.traces, uiPort: JAEGER_DEFAULT_PORTS.ui }
			: {};
	return { ...defaults, ...fromAddress, ...fromYaml };
}

function pairProcesses(
	jaegers: LocatedProcess[],
	collectors: LocatedProcess[],
): [LocatedProcess, LocatedProcess][] {
	const free = [...collectors];
	const pairs: [LocatedProcess, LocatedProcess][] = [];
	const byStart = [...jaegers].sort((a, b) => (a.startedMs ?? 0) - (b.startedMs ?? 0));
	for (const jaeger of byStart) {
		let best: LocatedProcess | undefined;
		let bestGap = Number.POSITIVE_INFINITY;
		for (const c of free) {
			if (jaeger.startedMs === null || c.startedMs === null) {
				if (jaegers.length === 1 && collectors.length === 1) best = c;
				continue;
			}
			const gap = c.startedMs - jaeger.startedMs;
			if (gap >= 0 && gap <= PAIR_WINDOW_MS && gap < bestGap) {
				best = c;
				bestGap = gap;
			}
		}
		if (best) {
			free.splice(free.indexOf(best), 1);
			pairs.push([jaeger, best]);
		}
	}
	return pairs;
}

const ROLE_FIELDS: [FoundRole, keyof RenderedPorts][] = [
	["traces", "otlpPort"],
	["ui", "uiPort"],
	["mcp", "mcpPort"],
	["logs", "logsOtlpPort"],
];

function metaOf(
	reads: DaemonReads,
	home: string,
	pair: Pair,
): { meta: DaemonMeta; unknownRoles: FoundRole[] } {
	const { jaeger, otelcol, ports } = pair;
	const platform = /telemetry-binaries-([a-z0-9-]+)\//.exec(jaeger.proc.binary)?.[1] ?? "unknown";
	return {
		meta: {
			jaegerPid: jaeger.row.pid,
			otelcolPid: otelcol.row.pid,
			otlpPort: ports.otlpPort ?? 0,
			uiPort: ports.uiPort ?? 0,
			mcpPort: ports.mcpPort ?? 0,
			jaegerHealthPort: ports.jaegerHealthPort ?? 0,
			otelcolHealthPort: ports.otelcolHealthPort ?? 0,
			logsOtlpPort: ports.logsOtlpPort ?? 0,
			startedAt: jaeger.row.startedAt ?? new Date(reads.now()).toISOString(),
			jaegerBinary: jaeger.proc.binary,
			otelcolBinary: otelcol.proc.binary,
			platform,
			logsPath: `${home}/telemetry/logs.jsonl`,
		},
		unknownRoles: ROLE_FIELDS.filter(([, field]) => ports[field] === undefined).map(
			([role]) => role,
		),
	};
}

/** This home's Jaegers and collectors, each paired with the collector started with it, ports labelled and none guessed. */
function pairsOf(reads: DaemonReads, home: string): { located: LocatedProcess[]; pairs: Pair[] } {
	const own = reads.processes().flatMap((row) => {
		const proc = daemonProcessOf(row.command);
		return proc && isOwn(proc, home) ? [{ row, proc }] : [];
	});
	if (own.length === 0) return { located: [], pairs: [] };
	const listening = reads.listening(own.map((d) => d.row.pid));
	const located: LocatedProcess[] = own.map(({ row, proc }) => ({
		row,
		proc,
		ports: listening[row.pid] ?? [],
		startedMs: row.startedAt === null ? null : Date.parse(row.startedAt),
	}));
	const pairs = pairProcesses(
		located.filter((p) => p.proc.role === "jaeger"),
		located.filter((p) => p.proc.role === "otelcol"),
	).map(
		([jaeger, otelcol]): Pair => ({ jaeger, otelcol, ports: labelPorts(reads, jaeger, otelcol) }),
	);
	return { located, pairs };
}

/** A pair found running with no record, as `startPlan` judges it. */
export interface Candidate {
	jaegerPid: number;
	otelcolPid: number;
	/** The traces port the pair holds, when it could be read. */
	tracesPort?: number;
	/** Every port the pair holds, by role, as far as they could be read. */
	ports?: Partial<Ports>;
}

/** The ports a labelled pair holds, by the address's roles; a role no socket named is left out. */
function portsHeld(labelled: RenderedPorts): Partial<Ports> {
	const held: Partial<Ports> = {};
	for (const [role, field] of [
		["traces", "otlpPort"],
		["ui", "uiPort"],
		["mcp", "mcpPort"],
		["logs", "logsOtlpPort"],
	] as const) {
		const port = labelled[field];
		if (port !== undefined) held[role] = port;
	}
	return held;
}

/** The pairs of this home's daemon processes running with no record to name them. */
export function candidatesOf(reads: DaemonReads, home: string): Candidate[] {
	return pairsOf(reads, home).pairs.map((p) => ({
		jaegerPid: p.jaeger.row.pid,
		otelcolPid: p.otelcol.row.pid,
		tracesPort: p.ports.otlpPort,
		ports: portsHeld(p.ports),
	}));
}

/**
 * What a finder would take over, judged from reads alone and written nowhere:
 * this home's Jaeger and collector paired, their ports read from the sockets
 * they listen on. Several daemons: the one holding `tracesPort` (the stored
 * address's, else Jaeger's own default), the rest strays; none holding it:
 * none taken. A lone pair is taken whatever its ports.
 */
function locateDaemon(
	reads: DaemonReads,
	home: string,
	tracesPort: number,
): { pair: Pair; strays: OwnProcess[] } | null {
	const { located, pairs } = pairsOf(reads, home);
	// One daemon is the daemon; only among several does the traces port decide.
	const taken = pairs.length === 1 ? pairs[0] : pairs.find((p) => p.ports.otlpPort === tracesPort);
	if (!taken) return null;
	const kept = new Set([taken.jaeger.row.pid, taken.otelcol.row.pid]);
	return {
		pair: taken,
		strays: located
			.filter((p) => !kept.has(p.row.pid))
			.map((p) => ownProcess(p.row, p.proc, p.ports)),
	};
}

/**
 * What a command says about a finding, or `null` when it was not the finder:
 * the command whose create lost read another's record and has nothing to add.
 */
export function describeFinding(found: Found): string | null {
	if (!found.finder) return null;
	const unread =
		found.unknownRoles.length > 0 ? `; ports not read: ${found.unknownRoles.join(", ")}` : "";
	return `  record was missing: found from the process list and its sockets, written again${unread}`;
}

function tracesPortOf(reads: DaemonReads, opts: { tracesPort?: number }): number {
	return opts.tracesPort ?? reads.address()?.traces ?? JAEGER_DEFAULT_PORTS.traces;
}

/**
 * `findDaemon` for a caller that already holds the home's lock (`ensureDaemon`,
 * which decides and writes under one): takes over the daemon holding
 * `tracesPort`, writing the record with an exclusive create.
 */
export function takeOverLocked(
	reads: DaemonReads,
	home: string,
	opts: { tracesPort?: number } = {},
): Found | null {
	const located = locateDaemon(reads, home, tracesPortOf(reads, opts));
	return located === null ? null : recordFound(reads, home, located);
}

/**
 * Under the lock: removes a record whose processes are all dead, re-read just
 * now by their command lines, so the exclusive create can write the daemon
 * that runs. A record naming a process that is still this home's daemon is
 * left as it is.
 */
function clearDeadRecord(reads: DaemonReads, home: string): void {
	const recorded = reads.record();
	if (recorded === null) return;
	const alive = reads.processes().some((row) => {
		const proc = daemonProcessOf(row.command);
		if (proc === null || !isOwn(proc, home)) return false;
		return (
			(proc.role === "jaeger" && row.pid === recorded.jaegerPid) ||
			(proc.role === "otelcol" && row.pid === recorded.otelcolPid)
		);
	});
	if (!alive) reads.removeRecord();
}

/** Under the lock: writes the record when no command has, or reads back the one that did. */
function recordFound(
	reads: DaemonReads,
	home: string,
	located: { pair: Pair; strays: OwnProcess[] },
): Found {
	clearDeadRecord(reads, home);
	const { meta, unknownRoles } = metaOf(reads, home, located.pair);
	const finder = reads.writeRecord(meta, { exclusive: true });
	return {
		meta: finder ? meta : (reads.record() ?? meta),
		unknownRoles,
		strays: located.strays,
		finder,
	};
}

/**
 * Finds this home's running daemon when its record is missing, and writes the
 * record again, exactly once.
 *
 * The ports come from the sockets the processes listen on, never a guess. A
 * role no socket or trusted rendered config can name is listed in
 * `unknownRoles` and recorded as port 0. The record is created with an
 * exclusive create under `<home>/telemetry.lock`: when two commands find the
 * daemon at once, one writes and is `finder`, the other reads that record back.
 *
 * `by` names the command that looked: the finder tells the found daemon what
 * it found and that the record had been lost (`reportFinding`).
 */
export async function findDaemon(
	reads: DaemonReads,
	home: string,
	by: string,
	opts: { tracesPort?: number } = {},
): Promise<Found | null> {
	const located = locateDaemon(reads, home, tracesPortOf(reads, opts));
	if (located === null) return null;
	const release = await reads.lock();
	let found: Found;
	try {
		found = recordFound(reads, home, located);
	} finally {
		release();
	}
	await reportFinding(reads, found, by);
	return found;
}

/** `findDaemon` for a synchronous caller (the evaluator decides its exporter at init). */
export function findDaemonSync(
	reads: DaemonReads,
	home: string,
	by: string,
	opts: { tracesPort?: number } = {},
): Found | null {
	const located = locateDaemon(reads, home, tracesPortOf(reads, opts));
	if (located === null) return null;
	const release = reads.lockSync();
	let found: Found;
	try {
		found = recordFound(reads, home, located);
	} finally {
		release();
	}
	// Fire and forget: a short-lived caller (the evaluator) may exit first, and the record is written either way.
	void reportFinding(reads, found, by);
	return found;
}
