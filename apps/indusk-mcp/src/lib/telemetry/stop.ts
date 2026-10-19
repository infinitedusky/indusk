import { isOwnProcess, type ProcessDeps, realProcessReads } from "../process-identity.js";
import { daemonConfigPath, daemonProcessOf, isOwn } from "./daemon-process.js";
import type { DaemonMeta } from "./status.js";

/**
 * Stopping the telemetry daemon (telemetry-stop-stops-what-it-started).
 *
 * A recorded process is this daemon's when it is alive and its command line
 * runs the recorded binary with this home's own config file. Its port is not
 * asked: under load a port can be slow, and judging by it once made stop
 * signal nothing, delete the record and report the daemon stopped (the 1.65.0
 * release left nine processes that way). A PID now held by another program,
 * or by the same binary from another home, is never signalled. Stop reports
 * stopped only when none of its own is left, and keeps the record otherwise.
 *
 * promise: indusk-stops-only-its-own-daemons
 */

/** What stopping reads and does, given as inputs so the decision is a unit test. */
export interface StopDeps extends ProcessDeps {
	kill(pid: number, signal: NodeJS.Signals): void;
	sleep(ms: number): Promise<void>;
}

export interface StopResult {
	/** None of the daemon's own processes is left running. */
	stopped: boolean;
	/** The record may be deleted: nothing of its own still runs. */
	clearRecord: boolean;
	signaled: number[];
	strangers: number[];
	stillRunning: number[];
}

/** The operating system's reads and signals, for `stop` and `reap`. */
export const realStopDeps: StopDeps = {
	alive: realProcessReads.alive,
	command: realProcessReads.command,
	kill: (pid, signal) => process.kill(pid, signal),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const GRACE_MS = 3000;
const POLL_MS = 100;

export async function stopDaemon(
	meta: DaemonMeta,
	home: string,
	deps: StopDeps,
): Promise<StopResult> {
	const recorded = [
		{ pid: meta.jaegerPid, binary: meta.jaegerBinary, config: daemonConfigPath(home, "jaeger") },
		{
			pid: meta.otelcolPid,
			binary: meta.otelcolBinary,
			config: daemonConfigPath(home, "otelcol"),
		},
	];
	// The home as the process was started with it, or as it really is: a link and its target are one home.
	const ownByHome = (pid: number, binary: string): boolean => {
		const command = deps.alive(pid) ? deps.command(pid) : null;
		const proc = command === null ? null : daemonProcessOf(command);
		return proc !== null && command?.includes(binary) === true && isOwn(proc, home);
	};
	const own = recorded
		.filter((p) => isOwnProcess(p.pid, [p.binary, p.config], deps) || ownByHome(p.pid, p.binary))
		.map((p) => p.pid);
	const strangers = recorded
		.filter((p) => deps.alive(p.pid) && !own.includes(p.pid))
		.map((p) => p.pid);

	const stillRunning = await terminate(own, deps);
	const stopped = stillRunning.length === 0;
	return { stopped, clearRecord: stopped, signaled: own, strangers, stillRunning };
}

/**
 * SIGTERM, a grace period, then SIGKILL; the pids still running afterwards.
 * Shared by `stop` and `reap`: both end only processes they have already
 * judged InDusk's own.
 */
export async function terminate(pids: number[], deps: StopDeps): Promise<number[]> {
	for (const pid of pids) signal(deps, pid, "SIGTERM");
	for (
		let waited = 0;
		waited < GRACE_MS && pids.some((pid) => deps.alive(pid));
		waited += POLL_MS
	) {
		await deps.sleep(POLL_MS);
	}
	for (const pid of pids.filter((p) => deps.alive(p))) signal(deps, pid, "SIGKILL");
	await deps.sleep(POLL_MS);
	return pids.filter((pid) => deps.alive(pid));
}

function signal(deps: StopDeps, pid: number, sig: NodeJS.Signals): void {
	try {
		deps.kill(pid, sig);
	} catch {
		// already gone
	}
}
