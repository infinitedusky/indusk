/**
 * Whether a recorded process is still ours (small-fixes A14): alive, and its
 * command line carries every marker we recorded when we started it — the
 * binary we ran, the config we gave it, the port flag we passed. Never its
 * port: under load a port can be slow to answer, and judging by it once made
 * `telemetry stop` signal nothing, delete the record and report the daemon
 * stopped (the 1.65.0 release left nine processes that way); `ui stop` kept
 * its own copy of the older rule until this. A PID the OS has recycled to a
 * stranger carries none of the markers and is never signalled.
 *
 * One definition for every daemon InDusk stops; the reads are inputs so the
 * rule is a unit test.
 *
 * promise: indusk-stops-only-its-own-daemons
 */

/** What identity reads, given as inputs. */
export interface ProcessDeps {
	alive(pid: number): boolean;
	/** The process's command line, or `null` when it cannot be read. */
	command(pid: number): string | null;
}

export function isOwnProcess(pid: number, markers: readonly string[], deps: ProcessDeps): boolean {
	if (!deps.alive(pid)) return false;
	const cmd = deps.command(pid);
	return cmd !== null && markers.every((marker) => cmd.includes(marker));
}
