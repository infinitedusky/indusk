import type { Holder, PortHolder, Ports, StoredAddress } from "./daemon-address.js";
import type { DaemonState, Found } from "./daemon-state.js";
import type { DaemonReads } from "./daemon-reads.js";
import type { DaemonMeta } from "./status.js";

/**
 * What a start does, decided from what is running, the stored address and what
 * holds its ports; and `ensureDaemon`, the one way anything starts the daemon.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

/** A Jaeger and the collector paired with it, found running with no record. */
export interface Candidate {
	jaegerPid: number;
	otelcolPid: number;
	/** The traces port the pair holds, when it could be read. */
	tracesPort?: number;
}

export type StartState =
	| { kind: "running" }
	| { kind: "found"; candidates: Candidate[] }
	| { kind: "none" };

export type StartPlan =
	| { kind: "running" }
	| { kind: "takeover"; tracesPort?: number; strays: number[]; store?: StoredAddress }
	| { kind: "start"; ports: Ports; store?: StoredAddress }
	| { kind: "refuse"; holders: PortHolder[] }
	| { kind: "refuse-several"; listed: number[] };

export function startPlan(
	_state: StartState,
	_holders: Record<number, Holder | null>,
	_home: string,
	_opts: { address: StoredAddress | null; given?: Partial<Ports>; spare?: number[] },
): StartPlan {
	return { kind: "refuse", holders: [] };
}

export function refusalText(_plan: StartPlan, _home: string, _address: StoredAddress | null): string {
	return "";
}

export interface DaemonStartOptions {
	otlpPort?: number;
	uiPort?: number;
	logsPort?: number;
	mcpPort?: number;
}

/** The ports a start was given, refused by name in the real home. */
export function startOptions(_opts: DaemonStartOptions, _home: string): Partial<Ports> {
	return {};
}

export type SpawnDaemon = (request: { ports: Ports }) => Promise<DaemonMeta>;

export type EnsureResult =
	| { kind: "running"; meta: DaemonMeta }
	| { kind: "took-over"; meta: DaemonMeta; found: Found; strays: number[]; stored?: StoredAddress }
	| { kind: "started"; meta: DaemonMeta; stored?: StoredAddress }
	| { kind: "refused"; text: string };

export async function ensureDaemon(
	_by: string,
	_reads: DaemonReads,
	_home: string,
	_spawn: SpawnDaemon,
	_opts: { given?: Partial<Ports>; spare?: number[] } = {},
): Promise<EnsureResult> {
	return { kind: "refused", text: "" };
}

/** What `start` prints and exits with for an outcome. */
export function startReport(_result: EnsureResult): { code: number; text: string } {
	return { code: 1, text: "" };
}

/** The ports a restart brings the daemon up on. */
export function restartPorts(_state: DaemonState, _home: string): Ports | null {
	return null;
}
