import { isOwnProcess } from "../process-identity.js";
import { daemonConfigPath } from "./daemon-process.js";
import type { DaemonReads } from "./daemon-reads.js";
import { daemonReports, type Report } from "./daemon-reports.js";
import { type DaemonState, daemonState, type OwnProcess } from "./daemon-state.js";
import { type StopDeps, terminate } from "./stop.js";

/**
 * What `indusk telemetry reap` stops, decided from reads, and what it says.
 *
 * A stray is a daemon process of this home that the record does not name: what
 * a lost record leaves behind, whether or not its config file is still there
 * (an orphan is the stray whose home was deleted underneath it). Another
 * home's daemon, a test's daemon and every process that is not InDusk's are
 * not strays and are never signalled; before each signal the process is read
 * again by its command line, so a pid the operating system gave to something
 * else since the list was read is left alone. With no record, no process is
 * known to be the daemon, so nothing is stopped: `telemetry start` takes the
 * running one over first.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 * lesson: identify-a-process-by-what-it-cannot-rewrite
 */

/** The strays of this home to stop: none while the record is missing. */
export function reapPlan(state: DaemonState): OwnProcess[] {
	return state.kind === "found" ? [] : state.strays;
}

/** A recorded daemon is there to receive a report: the record names a process that is still InDusk's. */
const hasDaemon = (state: DaemonState): boolean =>
	state.kind === "running" || state.kind === "partial";

const label = (p: OwnProcess): string => `${p.role} ${p.pid}`;

export interface ReapResult {
	code: number;
	text: string;
	stopped: OwnProcess[];
	stillRunning: OwnProcess[];
	/** What to tell the recorded daemon, made once the reap is over; none without a record or on a dry run. */
	reports: Report[];
}

/** Stops this home's strays and says which stopped and which would not. */
export async function runReap(
	reads: DaemonReads,
	home: string,
	deps: StopDeps,
	opts: { dryRun?: boolean } = {},
): Promise<ReapResult> {
	const result = await reap(reads, home, deps, opts);
	// At its end, to the recorded daemon: what remains of the strays.
	if (result.reports.length > 0) {
		await reads.report?.(reads.record()?.otlpPort ?? 0, result.reports);
	}
	return result;
}

async function reap(
	reads: DaemonReads,
	home: string,
	deps: StopDeps,
	opts: { dryRun?: boolean },
): Promise<ReapResult> {
	const state = daemonState(reads, home);
	const plan = reapPlan(state);
	if (state.kind === "found") {
		return {
			code: 0,
			text: `The record is missing while a daemon runs (${state.found.map(label).join(" and ")}); run \`indusk telemetry start\` to take it over first. Nothing was stopped.`,
			stopped: [],
			stillRunning: [],
			reports: [],
		};
	}
	if (plan.length === 0) {
		return {
			code: 0,
			text: "No strays to stop.",
			stopped: [],
			stillRunning: [],
			reports: hasDaemon(state) ? daemonReports("reap", { ...state, strays: [] }) : [],
		};
	}
	if (opts.dryRun) {
		return {
			code: 0,
			text: [
				`Would stop ${plan.length} stray(s):`,
				...plan.map((p) => `  Would stop ${label(p)}`),
			].join("\n"),
			stopped: [],
			stillRunning: [],
			reports: [],
		};
	}

	const own = plan.filter((p) =>
		isOwnProcess(p.pid, [p.binary, daemonConfigPath(home, p.role)], deps),
	);
	const left = new Set(
		await terminate(
			own.map((p) => p.pid),
			deps,
		),
	);
	const stillRunning = own.filter((p) => left.has(p.pid));
	const stopped = own.filter((p) => !left.has(p.pid));
	const lines = stopped.map((p) => `  stopped ${label(p)}`);
	for (const p of stillRunning) {
		lines.push(`  ${label(p)} would not stop; stop it by hand`);
	}
	return {
		code: stillRunning.length > 0 ? 1 : 0,
		text: [`Strays of this home (${plan.length}):`, ...lines].join("\n"),
		stopped,
		stillRunning,
		reports: hasDaemon(state) ? daemonReports("reap", { ...state, strays: stillRunning }) : [],
	};
}
