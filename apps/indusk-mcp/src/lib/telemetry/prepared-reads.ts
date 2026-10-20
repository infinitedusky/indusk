import type { PsRow } from "../process-identity.js";
import { keptRead } from "../run-record/kept-reads.js";
import type { Exec } from "../start-program.js";
import { type DaemonReads, listeningAsync } from "./daemon-reads.js";
import { daemonState } from "./daemon-state.js";

/**
 * Daemon reads for a caller that must not stop the server (admin-pages-load-fast, decision 9):
 * the same bundle as `base`, with the process list handed in (read once, kept, shared with the
 * page) and the listening sockets read by an asynchronous `lsof`, instead of the `ps` and `lsof`
 * the resolver would start itself.
 *
 * The resolver asks for the sockets of this home's daemon processes the record does not name (and
 * of orphans), and the list alone says which those are, so one pass of `daemonState` over the list,
 * which reads and writes nothing, learns the pids; their sockets are read; the caller then resolves
 * over what was read. A daemon the resolver still cannot decide on reads as not running.
 */
export async function preparedDaemonReads(
	base: DaemonReads,
	home: string,
	rows: readonly PsRow[],
	deps: { exec?: Exec } = {},
): Promise<DaemonReads> {
	const asked = new Set<number>();
	daemonState(
		{
			...base,
			processes: () => [...rows],
			listening(pids) {
				for (const pid of pids) asked.add(pid);
				return {};
			},
		},
		home,
	);
	const pids = [...asked].sort((a, b) => a - b);
	// Kept like the list: every reader a page makes asks the same pids, and one read answers them.
	const sockets =
		pids.length === 0
			? {}
			: (await keptRead(`listening:${pids.join(",")}`, () => listeningAsync(pids, deps))).value;
	return {
		...base,
		processes: () => [...rows],
		listening: (ids) => Object.fromEntries(ids.map((pid) => [pid, sockets[pid] ?? []])),
	};
}
