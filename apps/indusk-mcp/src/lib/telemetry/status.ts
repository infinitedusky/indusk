import { existsSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { isAlive } from "../process-identity.js";
import type { DaemonReads } from "./daemon-reads.js";
import { realDaemonReads } from "./daemon-reads.js";
import {
	daemonState,
	type PortAnswer,
	type ReachedDaemon,
	resolveLocalDaemon,
	resolveLocalDaemonSync,
	resolveLocalDaemonVia,
} from "./daemon-state.js";

/**
 * The read side of the local telemetry daemon: where it records itself, and
 * whether it is running (day-monitor split this out of `daemon.ts`).
 *
 * Readers — `indusk promises status`, the admin's health chips, the
 * evaluator's exporter — need only this. `daemon.ts` resolves and spawns the
 * platform binaries through `createRequire`, and a bundler that follows that
 * import (the admin's Turbopack does) tries to parse the Jaeger binary as
 * source. Nothing here spawns or resolves a binary. `daemon.ts` re-exports
 * the public names, so its importers are unchanged.
 */

export function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

export function pidFilePath(): string {
	return join(induskHome(), "telemetry.pid");
}

/** Where the daemon's ports are recorded — the file a reader names when no daemon answers. */
export function daemonMetaPath(): string {
	return metaFilePath();
}

export function metaFilePath(): string {
	return join(induskHome(), "telemetry.json");
}

export interface DaemonMeta {
	jaegerPid: number;
	otelcolPid: number;
	otlpPort: number;
	uiPort: number;
	mcpPort: number;
	jaegerHealthPort: number;
	otelcolHealthPort: number;
	logsOtlpPort: number;
	startedAt: string;
	jaegerBinary: string;
	otelcolBinary: string;
	platform: string;
	logsPath: string;
	/** The size of `telemetry.log` just before this daemon was spawned: where its own lines begin. Absent in a record written by a finder. */
	logOffset?: number;
}

export type DaemonStatusResult =
	| {
			running: true;
			jaegerPid: number;
			otelcolPid: number;
			otlpPort: number;
			uiPort: number;
			mcpPort: number;
			startedAt: string;
	  }
	| { running: false };

// ---- port + identity -------------------------------------------------------

/**
 * Whether something accepts connections on `port`. A refusal is final; a
 * timeout is tried once more before it is believed, because the 500 ms is
 * measured on the caller's own event loop: a loop held by other work (the
 * admin rendering a page) fires the timer before it delivers a connect that
 * already happened, and a listening port reads as closed. Nothing decides
 * whether the daemon runs from this answer any more: `daemonStatus` judges the
 * recorded processes by their command lines, and no read removes the record.
 */
export async function isPortListening(port: number, attempts = 2): Promise<boolean> {
	for (let i = 0; i < attempts; i++) {
		const result = await connectOnce(port);
		if (result !== "timeout") return result === "connected";
	}
	return false;
}

function connectOnce(port: number): Promise<"connected" | "refused" | "timeout"> {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: "127.0.0.1" });
		const done = (result: "connected" | "refused" | "timeout"): void => {
			socket.destroy();
			resolve(result);
		};
		socket.once("connect", () => done("connected"));
		socket.once("error", () => done("refused"));
		socket.setTimeout(500, () => done("timeout"));
	});
}

// One liveness check for every process InDusk reads (small-fixes A23).
export { isAlive };

export function cleanupFiles(): void {
	for (const p of [pidFilePath(), metaFilePath()]) {
		if (existsSync(p)) rmSync(p, { force: true });
	}
}

/** Where a reader looks when it is handed no machine of its own: this home, as the operating system shows it. */
export interface ResolveDeps {
	reads?: DaemonReads;
	home?: string;
}

function resolveOpts(
	by: string,
	deps: ResolveDeps,
): { reads: DaemonReads; home: string; by: string } {
	const home = deps.home ?? induskHome();
	return { reads: deps.reads ?? realDaemonReads(home), home, by };
}

/** `resolveLocalDaemonHere`, saying whether the record or a finding reached the daemon. */
export function resolveLocalDaemonViaHere(
	by: string,
	deps: ResolveDeps = {},
): Promise<ReachedDaemon | null> {
	return resolveLocalDaemonVia(resolveOpts(by, deps));
}

/**
 * The local daemon a reader should reach, or null: the one resolver behind
 * every reader (`resolveLocalDaemon`), asked for this home unless handed reads.
 */
export function resolveLocalDaemonHere(
	by: string,
	deps: ResolveDeps = {},
): Promise<DaemonMeta | null> {
	return resolveLocalDaemon(resolveOpts(by, deps));
}

/**
 * The running daemon's OTLP/HTTP endpoint, or null when none is running.
 *
 * Synchronous on purpose — the evaluator decides its exporter at init, which
 * is sync — so it reads the process list and the daemon's listening sockets
 * (`ps`, `lsof`) and opens no connection. It follows the record, and finds the
 * daemon when the record is gone, through the same resolver as every reader.
 */
export function liveOtlpEndpointSync(deps: ResolveDeps = {}): string | null {
	const meta = resolveLocalDaemonSync(resolveOpts("evaluator", deps));
	return meta === null ? null : `http://localhost:${meta.otlpPort}`;
}

/**
 * The running daemon's OTLP/HTTP logs endpoint (its collector's port), or null
 * when none is running or the finder could not read that port from a socket.
 * The evaluator's log records go here, never to the traces port.
 */
export function liveLogsEndpointSync(deps: ResolveDeps = {}): string | null {
	const meta = resolveLocalDaemonSync(resolveOpts("evaluator", deps));
	if (meta === null) return null;
	const stored = (deps.reads ?? realDaemonReads(deps.home ?? induskHome())).address();
	const port = meta.logsOtlpPort > 0 ? meta.logsOtlpPort : (stored?.logs ?? 0);
	return port > 0 ? `http://localhost:${port}` : null;
}

/**
 * Whether the daemon runs, judged by what its recorded processes are now (their
 * command lines), never by a port answering. A slow port is a running daemon;
 * a record whose processes are gone reads not running and stays where it is.
 * Only `stop` removes the record, and `start` writes over a stale one.
 */
export async function daemonStatus(
	reads: DaemonReads = realDaemonReads(induskHome()),
): Promise<DaemonStatusResult> {
	const state = daemonState(reads, induskHome());
	if (state.kind !== "running" || state.meta === null) return { running: false };
	const meta = state.meta;
	return {
		running: true,
		jaegerPid: meta.jaegerPid,
		otelcolPid: meta.otelcolPid,
		otlpPort: meta.otlpPort,
		uiPort: meta.uiPort,
		mcpPort: meta.mcpPort,
		startedAt: meta.startedAt,
	};
}

/** How each port a record names answers, and how long each wait was. */
export async function portAnswers(meta: DaemonMeta): Promise<Record<number, PortAnswer>> {
	const ports = [meta.otlpPort, meta.uiPort, meta.logsOtlpPort, meta.mcpPort].filter((p) => p > 0);
	const answered = await Promise.all(
		ports.map(async (port) => {
			const started = Date.now();
			const answer = await connectOnce(port);
			return [port, { answer, waitedMs: Date.now() - started }] as const;
		}),
	);
	return Object.fromEntries(answered);
}
