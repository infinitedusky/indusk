import { daemonProcessOf, isOwn, type OwnProcess } from "./daemon-process.js";
import type { DaemonReads } from "./daemon-reads.js";
import { daemonReports, type Report } from "./daemon-reports.js";
import { type DaemonState, daemonState } from "./daemon-state.js";
import { type StopDeps, terminate } from "./stop.js";

/**
 * What `indusk telemetry reap` stops, decided from reads, and what it says.
 *
 * Two kinds are stopped. A stray is a daemon process of this home that the
 * record does not name: what a lost record leaves behind. An orphan is a
 * daemon process of any home whose config file is gone: its home was deleted
 * underneath it, so it is no one's daemon (the leak of test daemons). Another
 * live home's daemon, this home's recorded daemon and every process that is
 * not InDusk's are never signalled; before each signal the process is read
 * again by its command line, so a pid the operating system gave to something
 * else since the list was read is left alone. While the record is lost, the
 * running daemon is not known, so no stray is stopped: `telemetry start` takes
 * it over first.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 * lesson: identify-a-process-by-what-it-cannot-rewrite
 */

/** The strays of this home and the orphans of any home to stop: no stray while the record is lost, and never a process the record names or one found running. */
export function reapPlan(state: DaemonState): OwnProcess[] {
	const spared = new Set([
		...(state.meta === null ? [] : [state.meta.jaegerPid, state.meta.otelcolPid]),
		...state.found.map((p) => p.pid),
	]);
	const plan = new Map<number, OwnProcess>();
	for (const p of [...state.strays, ...state.orphans]) {
		if (!spared.has(p.pid)) plan.set(p.pid, p);
	}
	return [...plan.values()];
}

/** A recorded daemon is there to receive a report: the record names a process that is still InDusk's. */
const hasDaemon = (state: DaemonState): boolean =>
	state.kind === "running" || state.kind === "partial";

const label = (p: OwnProcess): string => `${p.role} ${p.pid}`;

/** Read again just before the signal: still that binary, still InDusk's daemon, and either this home's or one whose config file is gone. */
function stillStoppable(p: OwnProcess, reads: DaemonReads, home: string, deps: StopDeps): boolean {
	if (!deps.alive(p.pid)) return false;
	const command = deps.command(p.pid);
	const proc = command === null ? null : daemonProcessOf(command);
	if (proc === null || proc.binary !== p.binary) return false;
	return isOwn(proc, home) || reads.stat(proc.configPath) === null;
}

export interface ReapResult {
	code: number;
	text: string;
	stopped: OwnProcess[];
	stillRunning: OwnProcess[];
	/** What to tell the recorded daemon, made once the reap is over; none without a record or on a dry run. */
	reports: Report[];
}

/** Stops this home's strays and every orphan, and says which stopped and which would not. */
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
	if (state.kind === "found" && plan.length === 0) {
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
				`Would stop ${plan.length} stray(s) and orphan(s):`,
				...plan.map((p) => `  Would stop ${label(p)}`),
			].join("\n"),
			stopped: [],
			stillRunning: [],
			reports: [],
		};
	}

	const own = plan.filter((p) => stillStoppable(p, reads, home, deps));
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
		text: [`Strays and orphans (${plan.length}):`, ...lines].join("\n"),
		stopped,
		stillRunning,
		reports: hasDaemon(state) ? daemonReports("reap", { ...state, strays: stillRunning }) : [],
	};
}
