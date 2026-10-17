import { spawnSync } from "node:child_process";
import { closeSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type PsRow, psAll } from "../process-identity.js";
import type { DaemonMeta } from "./status.js";

/**
 * Everything the daemon's decisions need from the machine, as one bundle.
 *
 * The functions that decide whether the daemon is running, partly running,
 * stale or absent, what `start` does, and what is a stray take a
 * `DaemonReads` and read nothing else: the record, the process list, the
 * sockets a process listens on, who holds a port, a file's stat, the daemon's
 * log, the clock. A test hands in a machine it describes; production hands in
 * `realDaemonReads`. The decision is then a unit test that opens no socket
 * and starts no process (`lesson: everyday-tests-never-wait`).
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export type ProcessRow = PsRow;

export interface DaemonReads {
	/** The record, or `null` when there is none or it cannot be read. */
	record(): DaemonMeta | null;
	/** Writes the record; with `exclusive`, only when none exists. Whether it wrote. */
	writeRecord(meta: DaemonMeta, opts: { exclusive: boolean }): boolean;
	/** The whole process list. */
	processes(): ProcessRow[];
	/** The TCP ports each process listens on. */
	listening(pids: number[]): Record<number, number[]>;
	/** Who holds each port, or `null` when nothing listens on it. */
	holders(ports: number[]): Record<number, { pid: number; command: string } | null>;
	/** A file's modification time and size, or `null` when it is not there. */
	stat(path: string): { mtimeMs: number; size: number } | null;
	/** The daemon's log lines from a byte offset, or written since a time. */
	logSince(from: { offset: number } | { time: number }): string[];
	now(): number;
}

function lsof(args: string[]): string {
	// lsof exits 1 when it finds nothing: that is an answer, not a failure.
	const r = spawnSync("lsof", ["-nP", ...args], { encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 });
	return r.stdout ?? "";
}

/** Parses `lsof -Fpn` output: `p<pid>` lines each followed by `n<addr>:<port>` lines. */
export function parseListening(out: string): Record<number, number[]> {
	const byPid: Record<number, number[]> = {};
	let pid = 0;
	for (const line of out.split("\n")) {
		if (line.startsWith("p")) pid = Number.parseInt(line.slice(1), 10);
		else if (line.startsWith("n") && pid > 0) {
			const port = Number.parseInt(line.slice(line.lastIndexOf(":") + 1), 10);
			if (Number.isInteger(port)) byPid[pid] = [...(byPid[pid] ?? []), port];
		}
	}
	for (const ports of Object.values(byPid)) ports.sort((a, b) => a - b);
	return byPid;
}

export function realDaemonReads(home: string): DaemonReads {
	const metaPath = join(home, "telemetry.json");
	const pidPath = join(home, "telemetry.pid");
	const logPath = join(home, "telemetry.log");
	return {
		record() {
			try {
				return JSON.parse(readFileSync(metaPath, "utf-8")) as DaemonMeta;
			} catch {
				return null;
			}
		},
		writeRecord(meta, opts) {
			try {
				writeFileSync(metaPath, JSON.stringify(meta, null, 2), {
					flag: opts.exclusive ? "wx" : "w",
				});
				writeFileSync(pidPath, String(meta.jaegerPid));
				return true;
			} catch {
				return false;
			}
		},
		processes: psAll,
		listening(pids) {
			const out =
				pids.length === 0
					? ""
					: lsof(["-a", "-p", pids.join(","), "-iTCP", "-sTCP:LISTEN", "-Fpn"]);
			const found = parseListening(out);
			return Object.fromEntries(pids.map((pid) => [pid, found[pid] ?? []]));
		},
		holders(ports) {
			const rows = psAll();
			return Object.fromEntries(
				ports.map((port) => {
					const pid = Number.parseInt(
						lsof([`-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"])
							.split("\n")
							.find((l) => l.startsWith("p"))
							?.slice(1) ?? "",
						10,
					);
					const command = rows.find((r) => r.pid === pid)?.command;
					return [port, Number.isInteger(pid) && command !== undefined ? { pid, command } : null];
				}),
			);
		},
		stat(path) {
			try {
				const s = statSync(path);
				return { mtimeMs: s.mtimeMs, size: s.size };
			} catch {
				return null;
			}
		},
		logSince(from) {
			try {
				if ("offset" in from) {
					const size = statSync(logPath).size;
					const buf = Buffer.alloc(Math.max(size - from.offset, 0));
					const fd = openSync(logPath, "r");
					try {
						readSync(fd, buf, 0, buf.length, from.offset);
					} finally {
						closeSync(fd);
					}
					return buf.toString("utf-8").split("\n").filter(Boolean);
				}
				return readFileSync(logPath, "utf-8")
					.split("\n")
					.filter((line) => {
						const at = Date.parse(line.slice(0, 24));
						return line !== "" && (Number.isNaN(at) || at >= from.time);
					});
			} catch {
				return [];
			}
		},
		now: () => Date.now(),
	};
}
