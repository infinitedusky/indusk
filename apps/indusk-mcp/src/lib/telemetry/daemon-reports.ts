import { markPromise } from "../promises/mark.js";
import { type SpanEvent, sendWatcherSpan, watcherSpanBody } from "../promises/probe.js";
import { ADDRESS_ROLES, ROLE_LABEL } from "./daemon-address.js";
import type { DaemonReads } from "./daemon-reads.js";
import type { DaemonState, Found, OwnProcess, SelfTracing } from "./daemon-state.js";

/**
 * What each InDusk command reports about the daemon, as spans the daemon
 * itself receives — one per part of the promise, sent by the command that
 * knows the answer at the moment it knows it.
 *
 * `daemonReports` decides from a state handed to it and sends nothing;
 * `sendDaemonReports` posts what was decided and never throws. The reports go
 * through the SDK-free path the watcher probe uses, not the evaluator's tracer
 * (its exporter follows `OTEL_EXPORTER_OTLP_ENDPOINT`, is off exactly when the
 * record is missing, and needs a flush), under their own service so the
 * readers' frequent probe cannot crowd them out of the query window.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

/** The promise every report concerns. */
export const DAEMON_PROMISE = "the-daemon-readers-follow-is-the-one-running";
/** The service the reports are sent as. */
export const TELEMETRY_SERVICE = "indusk-telemetry";
const REPORT_SPAN = "daemon.report";
/** A promise reader reports a read through the record at most this often per project. */
export const READER_REPORT_INTERVAL_MS = 15 * 60_000;
/** A report that has not been taken in this long is dropped: a report never holds a command. */
const SEND_TIMEOUT_MS = 2_000;

export type ReportClause =
	| "one-daemon-on-its-own-ports"
	| "a-read-never-loses-the-daemon"
	| "a-lost-daemon-is-found"
	| "nothing-starts-a-second"
	| "strays-are-cleared"
	| "the-log-is-readable";

type AttrValue = string | number | boolean;

export interface Report {
	clause: ReportClause;
	outcome: "upheld" | "broken";
	/** Opens with the clause's name; present on a broken report. */
	symptom?: string;
	/** Set by a promise reader, whose service marks many projects; telemetry commands set none. */
	project?: string;
	attributes: Record<string, AttrValue>;
}

export type ReportMoment =
	| "status"
	| "started"
	| "restarted"
	| "takeover"
	| "found"
	| "register"
	| "reap"
	| "read";

/** A daemon lost and found: who found it, and which Jaeger ran. */
export interface Finding {
	by: string;
	jaegerPid: number;
	startedAt: string;
}

/** What `register` did to the daemon and to other projects' entries. */
export interface Registered {
	project: string;
	daemon: "found" | "started" | "took over";
	otherEntriesChanged: { path: string; from: string; to: string }[];
}

/** The daemon as a command saw it, with what the command did beside it. */
export type ReportState = Pick<DaemonState, "meta" | "address" | "strays"> & {
	finding?: Finding;
	registered?: Registered;
	selfTracing?: SelfTracing;
};

const UPHELD_OR = (symptom: string | null) =>
	symptom === null ? { outcome: "upheld" as const } : { outcome: "broken" as const, symptom };

const describe = (p: OwnProcess): string =>
	`${p.role} ${p.pid} (started ${p.startedAt ?? "at an unknown time"}, ports ${
		p.ports.length > 0 ? p.ports.join(", ") : "none"
	})`;

function daemonAttributes(state: ReportState): Record<string, AttrValue> {
	const { meta } = state;
	if (meta === null) return {};
	const picked = state.address?.picked ?? [];
	return {
		"indusk.daemon.jaeger.pid": meta.jaegerPid,
		"indusk.daemon.otelcol.pid": meta.otelcolPid,
		"indusk.daemon.port.traces": meta.otlpPort,
		"indusk.daemon.port.logs": meta.logsOtlpPort,
		"indusk.daemon.port.ui": meta.uiPort,
		"indusk.daemon.port.mcp": meta.mcpPort,
		"indusk.daemon.layout": picked.length > 0 ? "picked" : "block",
		...(picked.length > 0
			? {
					"indusk.daemon.picked": picked.map((p) => `${p.role}:${p.blockPort}`).join(","),
					"indusk.daemon.picked.holders": picked
						.filter((p) => p.holder)
						.map((p) => `${p.role}:${p.holder}`)
						.join(","),
				}
			: {}),
	};
}

/** Each stored port the daemon does not hold, with the port it holds instead. A port that could not be read (0) is not a difference. */
function portsNotHeld(state: ReportState): string[] {
	const { meta, address } = state;
	if (meta === null || address === null) return [];
	const held = {
		traces: meta.otlpPort,
		logs: meta.logsOtlpPort,
		ui: meta.uiPort,
		mcp: meta.mcpPort,
	};
	return ADDRESS_ROLES.flatMap((role) =>
		held[role] > 0 && held[role] !== address[role]
			? [`${ROLE_LABEL[role]} on ${held[role]}, expected ${address[role]}`]
			: [],
	);
}

function onItsOwnPorts(state: ReportState): Report {
	const parts = [
		...(state.strays.length > 0
			? [`another InDusk daemon runs beside it: ${state.strays.map(describe).join("; ")}`]
			: []),
		...(portsNotHeld(state).length > 0
			? [`ports not held: ${portsNotHeld(state).join("; ")}`]
			: []),
	];
	const verdict = UPHELD_OR(
		parts.length === 0 ? null : `one-daemon-on-its-own-ports: ${parts.join(". ")}`,
	);
	return { clause: "one-daemon-on-its-own-ports", ...verdict, attributes: daemonAttributes(state) };
}

/** A start or restart that found nothing else beside the daemon it made ready. */
function nothingBesideIt(state: ReportState): Report {
	const verdict = UPHELD_OR(
		state.strays.length === 0
			? null
			: `a-lost-daemon-is-found: another InDusk daemon runs beside the one just started, which it missed: ${state.strays.map(describe).join("; ")}`,
	);
	return { clause: "a-lost-daemon-is-found", ...verdict, attributes: daemonAttributes(state) };
}

function lostFindingOf(state: ReportState): Finding | null {
	if (state.finding) return state.finding;
	return state.meta === null
		? null
		: { by: "a command", jaegerPid: state.meta.jaegerPid, startedAt: state.meta.startedAt };
}

function recordWasMissing(finding: Finding): Report {
	return {
		clause: "a-read-never-loses-the-daemon",
		outcome: "broken",
		symptom: `a-read-never-loses-the-daemon: the record was missing while jaeger ${finding.jaegerPid} (started ${finding.startedAt}) ran; found by ${finding.by}`,
		attributes: {
			"indusk.daemon.jaeger.pid": finding.jaegerPid,
			"indusk.daemon.found.by": finding.by,
		},
	};
}

function nothingStartsASecond(state: ReportState): Report[] {
	const { registered } = state;
	if (registered === undefined) return [];
	const parts = [
		...(state.strays.length > 0
			? [
					`a second InDusk daemon runs: ${state.strays.map((p) => `${p.role} ${p.pid}`).join(" and ")}`,
				]
			: []),
		...registered.otherEntriesChanged.map(
			(e) => `another project's entry changed: ${e.path} from ${e.from} to ${e.to}`,
		),
	];
	const verdict = UPHELD_OR(
		parts.length === 0 ? null : `nothing-starts-a-second: ${parts.join("; ")}`,
	);
	return [
		{
			clause: "nothing-starts-a-second",
			...verdict,
			attributes: {
				...daemonAttributes(state),
				"indusk.register.project": registered.project,
				"indusk.register.daemon": registered.daemon,
			},
		},
	];
}

function logIsReadable(state: ReportState): Report[] {
	const tracing = state.selfTracing;
	if (tracing === undefined) return [];
	const n = tracing.count;
	const verdict = UPHELD_OR(
		n === 0
			? null
			: `the-log-is-readable: ${n} line${n === 1 ? "" : "s"} of Jaeger failing to trace itself since the daemon started; first: ${tracing.first ?? ""}`,
	);
	return [
		{
			clause: "the-log-is-readable",
			...verdict,
			attributes: { ...daemonAttributes(state), "indusk.log.self_tracing.count": n },
		},
	];
}

/**
 * What a command reports at `moment`, decided from the state it saw. A moment
 * with no daemon to receive the report decides nothing.
 */
export function daemonReports(moment: ReportMoment, state: ReportState): Report[] {
	switch (moment) {
		case "status":
			return state.meta === null ? [] : [onItsOwnPorts(state), ...logIsReadable(state)];
		case "started":
		case "restarted":
			return state.meta === null ? [] : [onItsOwnPorts(state), nothingBesideIt(state)];
		case "takeover":
			return state.meta === null ? [] : [onItsOwnPorts(state)];
		case "found": {
			const finding = lostFindingOf(state);
			if (finding === null) return [];
			return [
				{
					clause: "a-lost-daemon-is-found",
					outcome: "upheld",
					attributes: daemonAttributes(state),
				},
				recordWasMissing(finding),
			];
		}
		case "register":
			return nothingStartsASecond(state);
		case "reap": {
			const verdict = UPHELD_OR(
				state.strays.length === 0
					? null
					: `strays-are-cleared: still running: ${state.strays.map(describe).join("; ")}`,
			);
			return [{ clause: "strays-are-cleared", ...verdict, attributes: daemonAttributes(state) }];
		}
		case "read":
			return [readUpheld(undefined)];
	}
}

function readUpheld(project: string | undefined): Report {
	return {
		clause: "a-read-never-loses-the-daemon",
		outcome: "upheld",
		...(project ? { project } : {}),
		attributes: {},
	};
}

/**
 * What a promise reader reports at its local probe. A read through an intact
 * record is upheld, once per project per quarter hour (`lastStamp` is when it
 * last reported, `now` the injected clock); a read that had to find the daemon
 * reports the finding's broken report and never an upheld one.
 */
export function readerReports(opts: {
	via: "record" | "found";
	project: string;
	now: number;
	lastStamp: number | null;
	found?: Finding;
}): Report[] {
	if (opts.via === "found") {
		return opts.found ? [{ ...recordWasMissing(opts.found), project: opts.project }] : [];
	}
	if (opts.lastStamp !== null && opts.now - opts.lastStamp < READER_REPORT_INTERVAL_MS) return [];
	return [readUpheld(opts.project)];
}

/** One report as an OTLP/JSON span body, its promise fields set by `markPromise`. */
export function reportBody(report: Report, at: Date = new Date()): unknown {
	const attributes: Record<string, AttrValue> = {};
	const events: SpanEvent[] = [];
	markPromise(
		{
			setAttribute(key: string, value: unknown) {
				attributes[key] = value as AttrValue;
				return this;
			},
			addEvent(name: string, attrs?: Record<string, unknown>) {
				events.push({ name, attributes: attrs as Record<string, AttrValue> });
				return this;
			},
		} as never,
		{
			promise: DAEMON_PROMISE,
			clause: report.clause,
			outcome: report.outcome,
			project: report.project,
			symptom: report.symptom,
		},
	);
	return watcherSpanBody(REPORT_SPAN, { ...report.attributes, ...attributes }, at, {
		service: TELEMETRY_SERVICE,
		events,
	}).body;
}

/** Posts one span body to a traces intake. */
export type PostSpan = (intakeUrl: string, body: unknown, timeoutMs: number) => Promise<void>;

const postToIntake: PostSpan = (intakeUrl, body, timeoutMs) =>
	sendWatcherSpan(intakeUrl, body, {}, timeoutMs);

/**
 * Sends `reports` to the daemon's traces port, which the caller read from a
 * daemon `daemonProcessOf` confirmed is InDusk's. Never throws: a report that
 * cannot be taken in about two seconds is dropped, and says nothing.
 */
export async function sendDaemonReports(
	otlpPort: number,
	reports: Report[],
	post: PostSpan = postToIntake,
): Promise<void> {
	if (!(otlpPort > 0) || reports.length === 0) return;
	await Promise.all(
		reports.map(async (report) => {
			try {
				await post(`http://localhost:${otlpPort}`, reportBody(report), SEND_TIMEOUT_MS);
			} catch {
				// a report never holds a command and never fails one
			}
		}),
	);
}

/**
 * What the command whose create wrote the record tells the daemon it found:
 * the finding, and that the record had been lost. A command that only read
 * another's record says nothing. The post is the caller's to await or not.
 */
export function reportFinding(reads: DaemonReads, found: Found, by: string): Promise<void> {
	if (!found.finder || reads.report === undefined) return Promise.resolve();
	const reports = daemonReports("found", {
		meta: found.meta,
		address: reads.address(),
		strays: found.strays,
		finding: { by, jaegerPid: found.meta.jaegerPid, startedAt: found.meta.startedAt },
	});
	return reads.report(found.meta.otlpPort, reports);
}
