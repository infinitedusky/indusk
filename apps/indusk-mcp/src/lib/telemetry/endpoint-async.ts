import { isAlive, type PsRow } from "../process-identity.js";
import { keptProcessTable } from "../run-record/async-reads.js";
import { peekKept } from "../run-record/kept-reads.js";
import { type Exec, onPage } from "../start-program.js";
import { type DaemonReads, realDaemonReads } from "./daemon-reads.js";
import { resolveLocalDaemonSync } from "./daemon-state.js";
import { preparedDaemonReads } from "./prepared-reads.js";
import { induskHome, type ResolveDeps } from "./status.js";

/**
 * The running daemon's OTLP endpoint without stopping the server (admin-pages-load-fast,
 * decision 9): the same resolver as `liveOtlpEndpointSync`, handed a process list read once
 * (kept, shared with every page) and the listening sockets read with one asynchronous `lsof`,
 * instead of letting it start `ps` and `lsof` itself. This was the port check on a page's path:
 * every clause-signal report a page made resolved the daemon, and with no daemon to find, each
 * resolved it again.
 *
 * The resolver asks for the sockets of the daemon processes it finds in the list; a first
 * pass over the list learns which pids those are, the sockets are read, and a second pass
 * decides. A daemon it cannot decide on reads as not running: the report is dropped, never
 * the page.
 */
export async function liveOtlpEndpointAsync(
	deps: ResolveDeps & { exec?: Exec } = {},
): Promise<string | null> {
	const home = deps.home ?? induskHome();
	const base: DaemonReads = deps.reads ?? realDaemonReads(home);
	// The record names the daemon this home started: its process alive (signal 0, no program) is
	// enough to send to its port. A report sent to a daemon that has gone is lost, not harmful.
	const recorded = base.record();
	if (recorded !== null && isAlive(recorded.jaegerPid))
		return `http://localhost:${recorded.otlpPort}`;
	// No record to follow: a daemon is found from the process list and its sockets. A page that has
	// read the list shares it; one that has not does not start a `ps` for a report, which is dropped.
	// Outside a page (the recorder's timer, the command line) the list is read, asynchronously.
	const rows = onPage() ? peekKept<PsRow[]>("ps") : await readList();
	if (rows === undefined) return null;
	const decided = await preparedDaemonReads(base, home, rows, deps);
	const meta = resolveLocalDaemonSync({ reads: decided, home, by: "evaluator" });
	return meta === null ? null : `http://localhost:${meta.otlpPort}`;
}

async function readList(): Promise<PsRow[] | undefined> {
	try {
		return (await keptProcessTable()).value;
	} catch {
		return undefined;
	}
}
