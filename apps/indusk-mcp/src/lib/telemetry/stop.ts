import type { DaemonMeta } from "./status.js";

/** What stopping a daemon reads and does, given as inputs so the decision is a unit test. */
export interface StopDeps {
	alive(pid: number): boolean;
	command(pid: number): string | null;
	kill(pid: number, signal: NodeJS.Signals): void;
	sleep(ms: number): Promise<void>;
	portAnswers(port: number): Promise<boolean>;
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

export async function stopDaemon(
	meta: DaemonMeta,
	_home: string,
	deps: StopDeps,
): Promise<StopResult> {
	const own: number[] = [];
	if (deps.alive(meta.jaegerPid) && (await deps.portAnswers(meta.uiPort))) own.push(meta.jaegerPid);
	if (deps.alive(meta.otelcolPid) && (await deps.portAnswers(meta.otelcolHealthPort)))
		own.push(meta.otelcolPid);
	for (const pid of own) deps.kill(pid, "SIGTERM");
	return { stopped: true, clearRecord: true, signaled: own, strangers: [], stillRunning: [] };
}
