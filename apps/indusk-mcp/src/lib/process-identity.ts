/**
 * Whether a recorded process is still ours (small-fixes A14): alive, and its
 * command line carries every marker we recorded when we started it — the
 * binary we ran, the config we gave it — and, when the record has one, it
 * started when the record says. Never its port: under load a port can be
 * slow to answer, and judging by it once made `telemetry stop` signal
 * nothing, delete the record and report the daemon stopped (the 1.65.0
 * release left nine processes that way). A PID the OS has recycled to a
 * stranger started later, and is never signalled.
 *
 * A marker must be read from a real process, not composed from the spawn
 * arguments (small-fixes A17): `next start` rewrites its process title, so
 * `ps` reads the admin daemon as `next-server (v16.2.4)` — no binary path,
 * no port flag — and an install renames its package folder aside, moving
 * its working directory. Its start time is the fact neither changes.
 * lesson: identify-a-process-by-what-it-cannot-rewrite
 *
 * One definition for every daemon InDusk stops; the reads are inputs so the
 * rule is a unit test.
 *
 * promise: indusk-stops-only-its-own-daemons
 */

import { spawnSync } from "node:child_process";

/** What identity reads, given as inputs. */
export interface ProcessDeps {
	alive(pid: number): boolean;
	/** The process's command line, or `null` when it cannot be read. */
	command(pid: number): string | null;
	/** When the process started, or `null` when it cannot be read. Needed only by a caller that passes `startedAt`. */
	startTime?(pid: number): Date | null;
}

/** `ps -o lstart=` reads to the second; the record is written just after spawn returns. */
const START_TOLERANCE_MS = 5000;

export function isOwnProcess(
	pid: number,
	markers: readonly string[],
	deps: ProcessDeps,
	startedAt?: string,
): boolean {
	if (!deps.alive(pid)) return false;
	const cmd = deps.command(pid);
	if (cmd === null || !markers.every((marker) => cmd.includes(marker))) return false;
	if (startedAt === undefined) return true;
	const started = deps.startTime?.(pid) ?? null;
	const recorded = Date.parse(startedAt);
	return (
		started !== null &&
		!Number.isNaN(recorded) &&
		Math.abs(started.getTime() - recorded) <= START_TOLERANCE_MS
	);
}

/** Whether `pid` is alive: signal 0, which delivers nothing and fails only for a pid that is gone. */
export function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** One `ps` field for one pid, in the C locale (so `lstart` is a date `Date` reads), or `null` when the pid is gone. */
export function ps(field: string, pid: number): string | null {
	const r = spawnSync("ps", ["-o", `${field}=`, "-p", String(pid)], {
		encoding: "utf-8",
		env: { ...process.env, LC_ALL: "C" },
	});
	return r.status === 0 ? r.stdout.trim() || null : null;
}

/**
 * The real reads behind `ProcessDeps`, for every daemon InDusk stops and every
 * session it ends (small-fixes A23): three modules each kept their own, and
 * only one read `ps` in the C locale.
 */
export const realProcessReads: Required<ProcessDeps> = {
	alive: isAlive,
	command: (pid) => ps("command", pid),
	startTime(pid) {
		const lstart = ps("lstart", pid);
		const at = lstart === null ? Number.NaN : Date.parse(lstart);
		return Number.isNaN(at) ? null : new Date(at);
	},
};
