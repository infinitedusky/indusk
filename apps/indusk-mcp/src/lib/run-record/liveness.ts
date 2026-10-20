import { isOwnProcess, type ProcessDeps } from "../process-identity.js";
import type { RunRecord } from "./record.js";

/**
 * Whether a run is going (a-run-can-be-trusted, Decision 4): the one rule,
 * asked of the run's own process — the step session's `claude` child — and
 * never of the admin daemon's. Alive means that pid, still running that
 * program, with the start time recorded just after it was spawned
 * (`isOwnProcess`, so a pid the OS recycled to a stranger reads as gone).
 *
 * promise: a-run-is-read-from-its-record
 * clause: a-run-is-read-from-its-record/dead-reads-stopped
 */

export interface RunStatus {
	state: "running" | "stopped" | "unknown";
	reason?: string;
}

/** What a run whose process is gone says; the situation sentence words it for the person. */
export const PROCESS_GONE = "the run's process is gone";

/**
 * `heldHere`: this daemon holds the run in memory as running, which is the gap
 * between two step sessions (one ended, the next not yet spawned). After a
 * restart there is no such entry, so the record alone decides. A record that
 * could not be read is unknown, never running.
 */
export function runStatus(
	record: RunRecord | "unknown" | null,
	deps: ProcessDeps,
	heldHere: boolean,
): RunStatus {
	if (record === "unknown") return { state: "unknown" };
	if (heldHere) return { state: "running" };
	if (record === null) return { state: "unknown" };
	if (record.stop) return { state: "stopped", reason: record.stopReason ?? record.stop.step };
	const p = record.process;
	if (p !== null && isOwnProcess(p.pid, [p.bin], deps, p.startedAt)) return { state: "running" };
	// A live pid the process table could not show is not a gone process: say unknown.
	if (p !== null && deps.unreadable?.(p.pid) === true) return { state: "unknown" };
	return { state: "stopped", reason: PROCESS_GONE };
}
