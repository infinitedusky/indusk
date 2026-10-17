import { type DaemonProcess, daemonProcessOf, isOwn } from "./daemon-process.js";
import type { DaemonReads, ProcessRow, RenderedPorts } from "./daemon-reads.js";
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
					// 0 is a port a finder could not read from a socket: said, never guessed.
					lines.push(
						`  ${`${name}:`.padEnd(11)}${port > 0 ? `http://localhost:${port}` : "unknown (not read from a socket)"}`,
					);
				}
				lines.push(`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`);
				lines.push(`  Started:   ${meta.startedAt}`);
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

// ---- finding a daemon whose record is gone ---------------------------------

/** Jaeger's own default receiver and interface ports: where a daemon started before the stored address listens. */
const JAEGER_DEFAULTS = { otlpPort: 4318, uiPort: 16686 } as const;
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

function labelPorts(
	reads: DaemonReads,
	jaeger: LocatedProcess,
	otelcol: LocatedProcess,
): RenderedPorts {
	const rendered = reads.renderedPorts();
	const fromYaml: RenderedPorts = {
		...trustedPorts(reads, jaeger, ["otlpPort", "uiPort", "mcpPort", "jaegerHealthPort"], rendered),
		...trustedPorts(reads, otelcol, ["logsOtlpPort", "otelcolHealthPort"], rendered),
	};
	const defaults =
		fromYaml.otlpPort === undefined &&
		jaeger.ports.includes(JAEGER_DEFAULTS.otlpPort) &&
		jaeger.ports.includes(JAEGER_DEFAULTS.uiPort)
			? JAEGER_DEFAULTS
			: {};
	return { ...defaults, ...fromYaml };
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

/**
 * What a finder would take over, judged from reads alone and written nowhere:
 * this home's Jaeger and collector paired, their ports read from the sockets
 * they listen on. Several daemons: the one holding `tracesPort` (Jaeger's own
 * 4318 until Build Phase 3 supplies the stored address), the rest strays;
 * none holding it: none taken. A lone pair is taken whatever its ports.
 */
function locateDaemon(
	reads: DaemonReads,
	home: string,
	tracesPort: number,
): { pair: Pair; strays: OwnProcess[] } | null {
	const own = reads.processes().flatMap((row) => {
		const proc = daemonProcessOf(row.command);
		return proc && isOwn(proc, home) ? [{ row, proc }] : [];
	});
	if (own.length === 0) return null;
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

/** Under the lock: writes the record when no command has, or reads back the one that did. */
function recordFound(
	reads: DaemonReads,
	home: string,
	located: { pair: Pair; strays: OwnProcess[] },
): Found {
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
 * The stored address, which this never writes, arrives in Build Phase 3.
 *
 * `by` names the command that looked, for the report Build Phase 5 sends.
 */
export async function findDaemon(
	reads: DaemonReads,
	home: string,
	_by: string,
	opts: { tracesPort?: number } = {},
): Promise<Found | null> {
	const located = locateDaemon(reads, home, opts.tracesPort ?? JAEGER_DEFAULTS.otlpPort);
	if (located === null) return null;
	const release = await reads.lock();
	try {
		return recordFound(reads, home, located);
	} finally {
		release();
	}
}

/** `findDaemon` for a synchronous caller (the evaluator decides its exporter at init). */
export function findDaemonSync(
	reads: DaemonReads,
	home: string,
	_by: string,
	opts: { tracesPort?: number } = {},
): Found | null {
	const located = locateDaemon(reads, home, opts.tracesPort ?? JAEGER_DEFAULTS.otlpPort);
	if (located === null) return null;
	const release = reads.lockSync();
	try {
		return recordFound(reads, home, located);
	} finally {
		release();
	}
}

// ---- the one resolver every reader of the local daemon calls ----------------

export interface ResolveOpts {
	reads: DaemonReads;
	home: string;
	/** The command asking, named in the finding's report from Build Phase 5. */
	by?: string;
}

/** The record's ports when a reader can reach the daemon through them: both processes are InDusk's and the traces and interface ports are known. */
function reachable(meta: DaemonMeta | null): DaemonMeta | null {
	return meta !== null && meta.otlpPort > 0 && meta.uiPort > 0 ? meta : null;
}

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
	const state = daemonState(opts.reads, opts.home);
	if (state.kind === "running") return reachable(state.meta);
	if (state.kind !== "found") return null;
	return reachable((await findDaemon(opts.reads, opts.home, opts.by ?? "reader"))?.meta ?? null);
}

/** `resolveLocalDaemon` for a synchronous caller: the evaluator decides its exporter at init. */
export function resolveLocalDaemonSync(opts: ResolveOpts): DaemonMeta | null {
	const state = daemonState(opts.reads, opts.home);
	if (state.kind === "running") return reachable(state.meta);
	if (state.kind !== "found") return null;
	return reachable(findDaemonSync(opts.reads, opts.home, opts.by ?? "reader")?.meta ?? null);
}
