import { spawnSync } from "node:child_process";
import {
	closeSync,
	linkSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	readSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { acquireLock, acquireLockAsync } from "../agents/lock.js";
import { type PsRow, psAll } from "../process-identity.js";
import { addressFilePath, readAddress, type StoredAddress } from "./daemon-address.js";
import { daemonConfigPath, homeKind, realTempRoots } from "./daemon-process.js";
import { type Report, sendDaemonReports } from "./daemon-reports.js";
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

/**
 * The ports the home's rendered config files name. A file is a claim about a
 * daemon, not a fact: the finder trusts it only for a process that started
 * after the file was written and that holds every port the file names.
 */
export interface RenderedPorts {
	otlpPort?: number;
	uiPort?: number;
	mcpPort?: number;
	jaegerHealthPort?: number;
	logsOtlpPort?: number;
	otelcolHealthPort?: number;
}

export interface DaemonReads {
	/** The record, or `null` when there is none or it cannot be read. */
	record(): DaemonMeta | null;
	/** Writes the record; with `exclusive`, only when none exists. Whether it wrote. */
	writeRecord(meta: DaemonMeta, opts: { exclusive: boolean }): boolean;
	/** Removes the record and its pid file; only the finder, under the home's lock, after re-reading that every process the record names is dead. */
	removeRecord(): void;
	/** The whole process list. */
	processes(): ProcessRow[];
	/** The TCP ports each process listens on. */
	listening(pids: number[]): Record<number, number[]>;
	/** Who holds each port, or `null` when nothing listens on it. */
	holders(ports: number[]): Record<number, { pid: number; command: string } | null>;
	/** A file's modification time and size, or `null` when it is not there. */
	stat(path: string): { mtimeMs: number; size: number } | null;
	/** The ports the home's rendered Jaeger and collector config files name, when they can be read. */
	renderedPorts(): RenderedPorts | null;
	/** The stored address (`<home>/telemetry-address.json`), or `null` when none is stored. */
	address(): StoredAddress | null;
	/** Why the address file cannot be read when it exists and is damaged; `null` when it is missing or fine. */
	addressProblem(): string | null;
	/** Writes the stored address whole (a temporary file, then a rename); with `exclusive`, only when none exists. Whether it wrote. */
	writeAddress(address: StoredAddress, opts: { exclusive: boolean }): boolean;
	/** Takes the home's `telemetry.lock`, waiting by yielding. The release function. */
	lock(): Promise<() => void>;
	/** `lock` for a synchronous caller. */
	lockSync(): () => void;
	/** The daemon's log lines from a byte offset, or written since a time. */
	logSince(from: { offset: number } | { time: number }): string[];
	now(): number;
	/**
	 * Tells the daemon listening on `otlpPort` something about itself
	 * (`daemonReports`). Never throws. Absent on a machine a test describes, and
	 * a no-op outside the real home: a temporary home's daemon is a test's, and
	 * nothing reads its reports.
	 */
	report?(otlpPort: number, reports: Report[]): Promise<void>;
}

/** `lsof`'s standard output, or `null` when `lsof` is not on the PATH. */
function lsofOrNull(args: string[]): string | null {
	// lsof exits 1 when it finds nothing: that is an answer, not a failure.
	const r = spawnSync("lsof", ["-nP", ...args], { encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 });
	if ((r.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return null;
	return r.stdout ?? "";
}

function lsof(args: string[]): string {
	return lsofOrNull(args) ?? "";
}

/**
 * The listening TCP ports of each process, from Linux's own files: the LISTEN
 * rows (state `0A`) of `/proc/net/tcp` and `/proc/net/tcp6` joined to the
 * socket inodes each process holds open. A pure parser: `netTcp` is both files'
 * text, `fds` maps a process id to the targets of its `/proc/<pid>/fd` links.
 */
export function listeningFromProc(
	netTcp: string,
	fds: Record<number, string[]>,
): Record<number, number[]> {
	const portByInode = new Map<string, number>();
	for (const line of netTcp.split("\n")) {
		const cols = line.trim().split(/\s+/);
		// sl local_address rem_address st tx_queue:rx_queue tr:tm->when retrnsmt uid timeout inode
		if (cols.length < 10 || cols[3] !== "0A") continue;
		const port = Number.parseInt(cols[1].slice(cols[1].lastIndexOf(":") + 1), 16);
		if (Number.isInteger(port) && cols[9] !== "0") portByInode.set(cols[9], port);
	}
	const byPid: Record<number, number[]> = {};
	for (const [pid, links] of Object.entries(fds)) {
		const ports = new Set<number>();
		for (const link of links) {
			const inode = /^socket:\[(\d+)\]$/.exec(link)?.[1];
			const port = inode === undefined ? undefined : portByInode.get(inode);
			if (port !== undefined) ports.add(port);
		}
		if (ports.size > 0) byPid[Number(pid)] = [...ports].sort((a, b) => a - b);
	}
	return byPid;
}

function listeningFromProcFs(pids: number[]): Record<number, number[]> {
	const netTcp = ["/proc/net/tcp", "/proc/net/tcp6"].map((f) => readText(f) ?? "").join("\n");
	const fds: Record<number, string[]> = {};
	for (const pid of pids) {
		try {
			fds[pid] = readdirSync(`/proc/${pid}/fd`).flatMap((fd) => {
				try {
					return [readlinkSync(`/proc/${pid}/fd/${fd}`)];
				} catch {
					return [];
				}
			});
		} catch {
			fds[pid] = [];
		}
	}
	return listeningFromProc(netTcp, fds);
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

/** The port in an `endpoint: 0.0.0.0:<port>` line that follows `anchor` in `text`. */
function endpointAfter(text: string, anchor: RegExp): number | undefined {
	const at = anchor.exec(text);
	if (!at) return undefined;
	const m = /endpoint:\s*\S*:(\d+)/.exec(text.slice(at.index + at[0].length));
	return m ? Number.parseInt(m[1], 10) : undefined;
}

/** Reads the ports the config files InDusk renders name (see `renderJaegerConfig` and `renderCollectorConfig`). */
export function parseRenderedPorts(
	jaegerYaml: string | null,
	collectorYaml: string | null,
): RenderedPorts {
	const out: RenderedPorts = {};
	if (jaegerYaml !== null) {
		out.otlpPort = endpointAfter(jaegerYaml, /^ {6}http:\s*$/m);
		out.uiPort = endpointAfter(jaegerYaml, /^ {2}jaeger_query:[\s\S]*?^ {4}http:\s*$/m);
		out.mcpPort = endpointAfter(jaegerYaml, /^ {2}jaeger_mcp:\s*\n {4}http:\s*$/m);
		out.jaegerHealthPort = endpointAfter(jaegerYaml, /^ {2}healthcheckv2:[\s\S]*?^ {4}http:\s*$/m);
	}
	if (collectorYaml !== null) {
		out.logsOtlpPort = endpointAfter(collectorYaml, /^ {6}http:\s*$/m);
		out.otelcolHealthPort = endpointAfter(collectorYaml, /^ {2}health_check:\s*$/m);
	}
	return out;
}

function readText(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

/**
 * The time a daemon log line was written, or `null` for a line with none.
 * Two formats share the file: Jaeger's own (`2026/10/16 19:13:04`, local time)
 * and the collector's and gRPC's (`2026-10-16T19:13:17.583-0400`, with an offset).
 */
export function timestampOf(line: string): number | null {
	const iso = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?)(Z|[+-]\d\d:?\d\d)?/.exec(line);
	if (iso) {
		const zone = iso[2]?.replace(/^([+-]\d\d)(\d\d)$/, "$1:$2") ?? "";
		const at = Date.parse(`${iso[1]}${zone}`);
		return Number.isNaN(at) ? null : at;
	}
	const slash = /^(\d{4})\/(\d\d)\/(\d\d) (\d\d):(\d\d):(\d\d)/.exec(line);
	if (slash) {
		const [y, mo, d, h, mi, sec] = slash.slice(1).map(Number);
		return new Date(y, mo - 1, d, h, mi, sec).getTime();
	}
	return null;
}

/** The lines written at or after `time`: scans back from the end to the first line stamped before it. */
export function linesSince(lines: string[], time: number): string[] {
	for (let i = lines.length - 1; i >= 0; i--) {
		const at = timestampOf(lines[i]);
		if (at !== null && at < time) return lines.slice(i + 1);
	}
	return lines;
}

/** A start holds the lock while two processes come up, up to 15 s each. */
const DAEMON_LOCK = { timeoutMs: 90_000, staleAfterMs: 90_000 };

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
		removeRecord() {
			rmSync(metaPath, { force: true });
			rmSync(pidPath, { force: true });
		},
		address() {
			const read = readAddress(home);
			return read.kind === "stored" ? read.address : null;
		},
		addressProblem() {
			const read = readAddress(home);
			return read.kind === "unreadable" ? read.problem : null;
		},
		writeAddress(address, opts) {
			const target = addressFilePath(home);
			const temporary = `${target}.${process.pid}.tmp`;
			try {
				mkdirSync(home, { recursive: true });
				writeFileSync(temporary, `${JSON.stringify(address, null, 2)}\n`);
				// Whole or not at all: the file appears by a rename, or by a link that fails when one is there.
				if (opts.exclusive) linkSync(temporary, target);
				else renameSync(temporary, target);
				return true;
			} catch {
				return false;
			} finally {
				rmSync(temporary, { force: true });
			}
		},
		processes: psAll,
		listening(pids) {
			if (pids.length === 0) return {};
			const out = lsofOrNull(["-a", "-p", pids.join(","), "-iTCP", "-sTCP:LISTEN", "-Fpn"]);
			const found = out === null ? listeningFromProcFs(pids) : parseListening(out);
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
		renderedPorts() {
			const jaeger = readText(daemonConfigPath(home, "jaeger"));
			const collector = readText(daemonConfigPath(home, "otelcol"));
			return jaeger === null && collector === null ? null : parseRenderedPorts(jaeger, collector);
		},
		lock() {
			mkdirSync(home, { recursive: true });
			return acquireLockAsync(join(home, "telemetry.lock"), DAEMON_LOCK);
		},
		lockSync() {
			mkdirSync(home, { recursive: true });
			return acquireLock(join(home, "telemetry.lock"), DAEMON_LOCK);
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
				return linesSince(readFileSync(logPath, "utf-8").split("\n").filter(Boolean), from.time);
			} catch {
				return [];
			}
		},
		now: () => Date.now(),
		async report(otlpPort, reports) {
			if (homeKind(home, realTempRoots()) !== "real") return;
			await sendDaemonReports(otlpPort, reports);
		},
	};
}
