import type { PromiseClause, PromiseEntry } from "./registry.js";

/**
 * Where a clause stands, read from its own signal (mark-first ADR D4).
 *
 * A clause is `holding` only when its signal has reported upheld in a real run
 * and nothing since breaks it; `no-signal` when nothing reported, or when the
 * watcher that would hear a report has gone blind; `broken` when its signal
 * says so. Passing tests are not an input: they prove a clause before release,
 * and this reads what the running system said (A5). A promise is its worst
 * clause (A14).
 *
 * The reports are the clause's spans after the readers have dropped a test
 * run's (`parseMarkedSpan`), handed in by the caller with the watcher's
 * heartbeat, so this decides from values and reads nothing itself
 * (`lesson: code-that-decides-takes-its-clock-and-its-reads`).
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/upheld-by-its-signal
 */

export type ClauseStanding = "broken" | "no-signal" | "holding";

/** One report of a clause's signal; `value` and `bound` are the measurement a signal may carry. */
export interface ClauseReport {
	outcome: "upheld" | "broken";
	/** When it ended (ISO). */
	at: string;
	value?: number;
	bound?: number;
}

export interface ClauseSignal {
	reports: ClauseReport[];
	/** The watcher that would hear a report is not blind. */
	heartbeatOk: boolean;
}

/** A report breaks the clause when it says broken, or measured past its bound. */
function breaks(r: ClauseReport): boolean {
	if (r.outcome === "broken") return true;
	return r.value !== undefined && r.bound !== undefined && r.value > r.bound;
}

/**
 * A split is broken by missing its budget at its point, so its newest report
 * decides; a limit by one report over its bound, however many were inside.
 */
export function clauseStanding(
	clause: Pick<PromiseClause, "kind">,
	signal: ClauseSignal,
): ClauseStanding {
	const newestFirst = [...signal.reports].sort((a, b) => b.at.localeCompare(a.at));
	const broken =
		clause.kind === "limit"
			? newestFirst.some(breaks)
			: newestFirst[0] !== undefined && breaks(newestFirst[0]);
	if (broken) return "broken";
	if (newestFirst.length === 0 || !signal.heartbeatOk) return "no-signal";
	return "holding";
}

const SEVERITY: Record<ClauseStanding, number> = { broken: 2, "no-signal": 1, holding: 0 };

/** The worst of several standings: broken, then no signal, then holding; null for none. */
export function worstStanding(standings: ClauseStanding[]): ClauseStanding | null {
	return standings.reduce<ClauseStanding | null>(
		(worst, s) => (worst === null || SEVERITY[s] > SEVERITY[worst] ? s : worst),
		null,
	);
}

/** A clause a signal can report: a split or a limit. A resting clause rests on another promise. */
export function hasSignalClauses(entry: Pick<PromiseEntry, "clauses">): boolean {
	return (entry.clauses ?? []).some((c) => c.kind !== "rests-on");
}

/**
 * Whether telemetry is read for a promise: a behaviour promise, or any other
 * with clauses a signal can report (a clause is read whatever its promise's
 * kind). A retired promise is not.
 */
export function readsSignal(entry: Pick<PromiseEntry, "kind" | "state" | "clauses">): boolean {
	return entry.state !== "retired" && (entry.kind === "behaviour" || hasSignalClauses(entry));
}

/** One clause of a promise with the standing it reads as. */
export interface ClauseRow {
	clause: string;
	kind: PromiseClause["kind"];
	standing: ClauseStanding;
	/** The newest report's time, ISO; null when none. */
	lastReport: string | null;
	/** For a resting clause, the promise it rests on. */
	restsOn?: string;
}

/** What a resting clause reads as: the standing of the promise it rests on. */
export type PromiseSignal = (name: string) => ClauseStanding;

/**
 * Every clause of `entry` with its standing: split and limit clauses from
 * their reports (`reportsOf` gives a clause's), resting clauses from the
 * promise they rest on. Empty for a promise stated before clauses.
 */
export function clauseRows(
	entry: Pick<PromiseEntry, "clauses">,
	reportsOf: (clause: string) => ClauseReport[],
	heartbeatOk: boolean,
	restingOn: PromiseSignal,
): ClauseRow[] {
	return (entry.clauses ?? []).map((c): ClauseRow => {
		if (c.kind === "rests-on") {
			const on = c.restsOn ?? "";
			return {
				clause: c.name,
				kind: c.kind,
				standing: restingOn(on),
				lastReport: null,
				restsOn: on,
			};
		}
		const reports = reportsOf(c.name);
		const newest = reports.reduce<string | null>(
			(n, r) => (n === null || r.at > n ? r.at : n),
			null,
		);
		return {
			clause: c.name,
			kind: c.kind,
			standing: clauseStanding(c, { reports, heartbeatOk }),
			lastReport: newest,
		};
	});
}

/** A promise's signal standing: the worst of its clauses; null for a promise with none. */
export function promiseSignal(rows: ClauseRow[]): ClauseStanding | null {
	return worstStanding(rows.map((r) => r.standing));
}

/** The sentence a person reads for a standing: holding, broken, or the honest no signal. */
export function standingWords(s: ClauseStanding): string {
	return s === "no-signal" ? "no signal" : s;
}
