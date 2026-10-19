import { readFileSync } from "node:fs";
import type { Tracer } from "@opentelemetry/api";
import type { PsRow } from "../process-identity.js";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";
import type { SessionRecord } from "../session/manager.js";
import type { RunKind, RunRecord } from "./record.js";
import { runRecordPath } from "./record.js";

/**
 * The signals for three clauses of `a-run-is-read-from-its-record`
 * (a-run-can-be-trusted, Build Phase 1; Decision 17). A signal that compares a
 * display with the function that produced it can never read broken, so each one
 * judges from a source the code it checks does not use: the file read back with
 * a plain `JSON.parse`, and the machine's process table (`psAll`) beside the
 * session manager's own sessions — never `runStatus` or `readRunRecord`.
 *
 * Each is best-effort: a signal must never fail the run it reports on.
 *
 * clause: a-run-is-read-from-its-record/kept-on-disk
 * clause: a-run-is-read-from-its-record/dead-reads-stopped
 * clause: a-run-is-read-from-its-record/never-in-progress-when-idle
 */

const PROMISE = "a-run-is-read-from-its-record";
const SIGNAL = { plan: "a-run-can-be-trusted", phase: "Build Phase 1" };
/** The tolerance `ps -o lstart=` leaves against a start time written just after spawn. */
const START_TOLERANCE_MS = 5000;

/** `ps` shows the process `pid` started at `startedAt`, read from the whole table. */
function livesIn(table: readonly PsRow[], pid: number, startedAt: string): boolean {
	const recorded = Date.parse(startedAt);
	return table.some(
		(row) =>
			row.pid === pid &&
			row.startedAt !== null &&
			Math.abs(Date.parse(row.startedAt) - recorded) <= START_TOLERANCE_MS,
	);
}

/** kept-on-disk: what the file holds equals the run that was written; null when it does. */
export function judgeKeptOnDisk(written: RunRecord, readBack: unknown): string | null {
	const same = JSON.stringify(readBack) === JSON.stringify(JSON.parse(JSON.stringify(written)));
	return same ? null : `${written.plan} ${written.kind} record differs from the run`;
}

/** After a write, read the file back as plain JSON and report whether it says what the run says. */
export async function reportKeptOnDisk(
	root: string,
	home: string,
	written: RunRecord,
	tracer?: Tracer,
): Promise<void> {
	try {
		let readBack: unknown;
		try {
			readBack = JSON.parse(readFileSync(runRecordPath(home, written.plan, written.kind), "utf-8"));
		} catch {
			readBack = null;
		}
		const broken = judgeKeptOnDisk(written, readBack);
		await writeClauseSignals(
			root,
			"run.record",
			written.plan,
			SIGNAL,
			[{ promise: PROMISE, clause: "kept-on-disk", ...(broken === null ? {} : { broken }) }],
			tracer,
		);
	} catch {
		// best-effort
	}
}

export interface DeadReadsInput {
	record: RunRecord;
	/** What the page shows for the run. */
	shown: "running" | "stopped" | "unknown";
	/** This daemon holds the run in memory as running. */
	heldHere: boolean;
	table: readonly PsRow[];
}

/**
 * dead-reads-stopped, judged against the process table when Build is pressed: a
 * run read as stopped whose step session still lives is broken (a live run called
 * dead), and so is a run read as running, and Build refused for it, with no such
 * process. Null when the record names no process to look for.
 */
export function judgeDeadReadsStopped(input: DeadReadsInput): ClauseVerdict | null {
	const { record, shown, heldHere, table } = input;
	const p = record.process;
	if (p === null || shown === "unknown") return null;
	const lives = livesIn(table, p.pid, p.startedAt);
	const base = { promise: PROMISE, clause: "dead-reads-stopped" };
	if (shown === "stopped" && lives)
		return {
			...base,
			broken: `${record.plan} read stopped, but its step session ${p.pid} is running`,
		};
	if (shown === "running" && !lives && !heldHere)
		return {
			...base,
			broken: `${record.plan} read running and Build was refused, but no process ${p.pid} lives`,
		};
	return base;
}

export async function reportDeadReadsStopped(
	root: string,
	input: DeadReadsInput,
	tracer?: Tracer,
): Promise<void> {
	try {
		const verdict = judgeDeadReadsStopped(input);
		if (verdict)
			await writeClauseSignals(root, "run.dead", input.record.plan, SIGNAL, [verdict], tracer);
	} catch {
		// best-effort
	}
}

export interface IdleInput {
	plan: string;
	kind: RunKind;
	/** This daemon's in-memory entry holds the run as running. */
	heldHere: boolean;
	/** The sessions the manager holds for the plan (its own sessions file). */
	sessions: readonly Pick<SessionRecord, "pid" | "startedAt">[];
	table: readonly PsRow[];
}

/**
 * never-in-progress-when-idle, for a plan shown in progress: it needs this daemon's own
 * running entry, or a process in the table whose pid and start time equal a session the
 * manager holds for it. With neither it is broken, naming the plan and what was shown.
 */
export function judgeNotInProgressWhenIdle(input: IdleInput): ClauseVerdict {
	const base = { promise: PROMISE, clause: "never-in-progress-when-idle" };
	if (input.heldHere) return base;
	if (input.sessions.some((s) => livesIn(input.table, s.pid, s.startedAt))) return base;
	return {
		...base,
		broken: `${input.plan} read as in progress (${input.kind}) with no process running for it`,
	};
}

export async function reportNotInProgressWhenIdle(
	root: string,
	input: IdleInput,
	tracer?: Tracer,
): Promise<void> {
	try {
		await writeClauseSignals(
			root,
			"run.idle",
			input.plan,
			SIGNAL,
			[judgeNotInProgressWhenIdle(input)],
			tracer,
		);
	} catch {
		// best-effort
	}
}
