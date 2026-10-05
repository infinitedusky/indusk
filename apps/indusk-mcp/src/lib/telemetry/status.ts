import { existsSync, readFileSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

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
 * already happened, and a listening port reads as closed. `daemonStatus`
 * deletes the daemon's record on that answer (promise-timeline, discovered at
 * Build Phase 4).
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

export function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export async function verifyIdentity(pid: number, port: number): Promise<boolean> {
	if (!isAlive(pid)) return false;
	return isPortListening(port);
}

export function cleanupFiles(): void {
	for (const p of [pidFilePath(), metaFilePath()]) {
		if (existsSync(p)) rmSync(p, { force: true });
	}
}

/**
 * The running daemon's OTLP/HTTP endpoint, or null when none is running.
 *
 * Synchronous on purpose — the evaluator decides its exporter at init, which
 * is sync — so it reads the meta file and checks the Jaeger PID is alive, and
 * opens no socket. A reused PID yields an endpoint nothing answers; the
 * exporter's failure is silent and the evaluation is unaffected.
 */
export function liveOtlpEndpointSync(): string | null {
	try {
		const meta = JSON.parse(readFileSync(metaFilePath(), "utf-8")) as DaemonMeta;
		process.kill(meta.jaegerPid, 0);
		return `http://localhost:${meta.otlpPort}`;
	} catch {
		return null;
	}
}

export async function daemonStatus(): Promise<DaemonStatusResult> {
	const pidFile = pidFilePath();
	const metaFile = metaFilePath();
	if (!existsSync(pidFile) || !existsSync(metaFile)) return { running: false };

	let meta: DaemonMeta;
	try {
		meta = JSON.parse(readFileSync(metaFile, "utf-8")) as DaemonMeta;
	} catch {
		return { running: false };
	}

	// Identity gate: BOTH processes alive AND both listening on their ports
	const jaegerOk = await verifyIdentity(meta.jaegerPid, meta.uiPort);
	const otelcolOk = await verifyIdentity(meta.otelcolPid, meta.otelcolHealthPort);
	if (!jaegerOk || !otelcolOk) {
		cleanupFiles();
		return { running: false };
	}

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
