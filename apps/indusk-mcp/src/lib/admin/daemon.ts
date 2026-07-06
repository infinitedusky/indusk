import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createConnection, createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The admin-ui daemon: a single long-lived `next start` process that serves
 * every registered project. Lifecycle is managed via three files under
 * `~/.indusk/` (or `$INDUSK_HOME/` during tests):
 *
 *   admin-ui.pid   — bare PID for liveness probing via `kill(pid, 0)`
 *   admin-ui.json  — richer metadata (port, startedAt, adminDir)
 *   admin-ui.log   — stdout + stderr from the detached child
 *
 * The daemon survives terminal close via `detached: true` + `unref()` +
 * `stdio: ["ignore", logFd, logFd]`. The parent process is free to exit
 * immediately after `daemonStart` resolves — the PID/meta files are the
 * durable handoff to subsequent `ui status`/`ui stop` invocations.
 */

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

function pidFilePath(): string {
	return join(induskHome(), "admin-ui.pid");
}

function metaFilePath(): string {
	return join(induskHome(), "admin-ui.json");
}

function logFilePath(): string {
	return join(induskHome(), "admin-ui.log");
}

function ensureHome(): void {
	const h = induskHome();
	if (!existsSync(h)) mkdirSync(h, { recursive: true });
}

export interface DaemonMeta {
	pid: number;
	port: number;
	startedAt: string;
	adminDir: string;
}

export interface DaemonStartOptions {
	port: number;
	adminDir: string;
	nextBin: string;
	projectRoot?: string;
}

/**
 * Spawn the admin-ui daemon. Returns the recorded metadata. The caller is
 * responsible for choosing a free port first (via `findFreePort`) — this
 * function does not probe.
 */
export async function daemonStart(opts: DaemonStartOptions): Promise<DaemonMeta> {
	ensureHome();

	const logFd = openSync(logFilePath(), "a");
	const child = spawn(
		"node",
		[opts.nextBin, "start", "--port", String(opts.port)],
		{
			cwd: opts.adminDir,
			detached: true,
			stdio: ["ignore", logFd, logFd],
			env: {
				...process.env,
				...(opts.projectRoot ? { INDUSK_PROJECT_ROOT: opts.projectRoot } : {}),
			},
		},
	);
	child.unref();

	if (typeof child.pid !== "number") {
		throw new Error("daemon spawn did not produce a PID");
	}

	const meta: DaemonMeta = {
		pid: child.pid,
		port: opts.port,
		startedAt: new Date().toISOString(),
		adminDir: opts.adminDir,
	};

	writeFileSync(pidFilePath(), String(child.pid));
	writeFileSync(metaFilePath(), JSON.stringify(meta, null, 2));

	return meta;
}

export interface DaemonStopResult {
	stopped: boolean;
	signaledPid?: number;
	usedSigkill?: boolean;
}

/**
 * Stop the daemon. SIGTERMs, polls for exit up to 3s, SIGKILLs on timeout,
 * then removes the PID + meta files.
 *
 * Returns `stopped: false` only when there was no daemon to stop (no PID
 * file or a malformed one). A daemon that was already dead on disk but had
 * leftover PID file returns `stopped: true` with the reaped PID — the
 * cleanup itself is work worth reporting.
 */
export async function daemonStop(): Promise<DaemonStopResult> {
	const pidFile = pidFilePath();
	if (!existsSync(pidFile)) return { stopped: false };

	const rawPid = readFileSync(pidFile, "utf-8").trim();
	const pid = Number.parseInt(rawPid, 10);
	if (!Number.isFinite(pid) || pid <= 0) {
		cleanupFiles();
		return { stopped: false };
	}

	if (!isAlive(pid)) {
		cleanupFiles();
		return { stopped: true, signaledPid: pid };
	}

	// Identity gate: if the PID is alive but the recorded port isn't
	// listening, the process on that PID isn't our daemon — a crashed
	// daemon's PID was recycled. Do NOT SIGTERM a stranger; clean up
	// the stale PID+meta files and return "stopped" so the caller isn't
	// misled into thinking there was a live daemon to kill.
	const metaFile = metaFilePath();
	if (existsSync(metaFile)) {
		try {
			const meta = JSON.parse(readFileSync(metaFile, "utf-8")) as DaemonMeta;
			if (!(await verifyIdentity(pid, meta.port))) {
				cleanupFiles();
				return { stopped: true, signaledPid: pid };
			}
		} catch {
			// Meta unreadable — fall through to legacy behavior (SIGTERM). Keeps
			// the stop path usable on hand-corrupted metadata; the StatusResult
			// path already returns running:false on parse failure.
		}
	}

	try {
		process.kill(pid, "SIGTERM");
	} catch {
		cleanupFiles();
		return { stopped: true, signaledPid: pid };
	}

	// Poll up to 3s (30 × 100ms)
	for (let i = 0; i < 30; i++) {
		await sleep(100);
		if (!isAlive(pid)) {
			cleanupFiles();
			return { stopped: true, signaledPid: pid };
		}
	}

	// Grace period expired — SIGKILL
	let usedSigkill = false;
	try {
		process.kill(pid, "SIGKILL");
		usedSigkill = true;
	} catch {
		// Raced with a late natural exit; treat as stopped.
	}

	cleanupFiles();
	return { stopped: true, signaledPid: pid, usedSigkill };
}

export type DaemonStatusResult =
	| { running: true; pid: number; port: number; adminDir: string; startedAt: string }
	| { running: false };

/**
 * Read the daemon's current status. Combines PID-file presence, a
 * `kill(pid, 0)` liveness check, and the recorded metadata. Does NOT probe
 * the port — the caller can do that separately if it wants to distinguish
 * "process alive but not yet listening" from "process alive and serving."
 */
export async function daemonStatus(): Promise<DaemonStatusResult> {
	const pidFile = pidFilePath();
	const metaFile = metaFilePath();
	if (!existsSync(pidFile) || !existsSync(metaFile)) return { running: false };

	const rawPid = readFileSync(pidFile, "utf-8").trim();
	const pid = Number.parseInt(rawPid, 10);
	if (!Number.isFinite(pid) || pid <= 0) return { running: false };

	let meta: DaemonMeta;
	try {
		meta = JSON.parse(readFileSync(metaFile, "utf-8")) as DaemonMeta;
	} catch {
		return { running: false };
	}

	// Identity gate: PID alive AND recorded port listening. After a crash
	// the OS may recycle the daemon's PID to an unrelated process; without
	// this check we'd report `running: true` for a stranger and `uiStart`
	// would refuse to spawn. On mismatch, the PID+meta files are stale —
	// sweep them so the next call starts clean.
	if (!(await verifyIdentity(pid, meta.port))) {
		cleanupFiles();
		return { running: false };
	}

	return {
		running: true,
		pid,
		port: meta.port,
		adminDir: meta.adminDir,
		startedAt: meta.startedAt,
	};
}

/**
 * Find a free port starting from `start`. If `start` is 0, the OS picks.
 * If `start` is taken, returns a fresh OS-picked port (does NOT scan
 * upward — scanning invites races between the check and the listen).
 */
export async function findFreePort(start: number): Promise<number> {
	if (start === 0) return pickAnyFreePort();
	if (await isPortFree(start)) return start;
	return pickAnyFreePort();
}

/**
 * Probe whether a port is currently accepting connections. Used by
 * `uiStatus` to verify the daemon is actually serving (not just alive in
 * the process table but stuck).
 */
export function isPortListening(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: "127.0.0.1" });
		const done = (result: boolean): void => {
			socket.destroy();
			resolve(result);
		};
		socket.once("connect", () => done(true));
		socket.once("error", () => done(false));
		socket.setTimeout(500, () => done(false));
	});
}

function pickAnyFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.once("error", reject);
		s.listen(0, () => {
			const addr = s.address();
			if (typeof addr === "object" && addr !== null) {
				const port = addr.port;
				s.close(() => resolve(port));
			} else {
				reject(new Error("Could not determine free port"));
			}
		});
	});
}

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const s = createServer();
		s.once("error", () => resolve(false));
		s.once("listening", () => s.close(() => resolve(true)));
		s.listen(port, "127.0.0.1");
	});
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Verify the recorded daemon identity beyond bare PID liveness: both
 * `isAlive(pid)` AND `isPortListening(port)` must return true. The port
 * probe is the load-bearing discriminator — after a daemon crash the OS
 * can recycle the PID to an unrelated process (bash, postgres, another
 * vitest), and a PID-only check would then false-positive that stranger
 * as "the daemon is running." The caller treats mismatch as stale.
 */
async function verifyIdentity(pid: number, port: number): Promise<boolean> {
	if (!isAlive(pid)) return false;
	return isPortListening(port);
}

function cleanupFiles(): void {
	const pidFile = pidFilePath();
	const metaFile = metaFilePath();
	if (existsSync(pidFile)) rmSync(pidFile, { force: true });
	if (existsSync(metaFile)) rmSync(metaFile, { force: true });
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
