import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Finding and reaping telemetry processes that outlived their configuration.
 *
 * The daemon is spawned `detached` + `unref()`ed so it survives the terminal
 * that started it — correct for a daemon, and the reason an orphan is possible
 * at all. Its PIDs live only in `$INDUSK_HOME/telemetry.json`, so anything that
 * removes that home (a test fixture, a deleted worktree, `rm -rf /tmp/...`)
 * severs the only handle anyone had on the processes.
 *
 * The reliable signal for "orphan" is the one the reporter of this bug
 * identified: **the `--config` path the process was started with no longer
 * exists.** A live daemon's config sits inside its live home; an orphan's
 * points into a directory that has been deleted. Every one of the 2,058
 * processes found on 2026-08-13 matched that test, and the real daemon did not.
 */

/** A telemetry process discovered on this machine. */
export interface TelemetryProcess {
	pid: number;
	/** `jaeger` or `otelcol`, derived from the binary path. */
	binary: string;
	/** The `--config=` value, with any `file:` scheme stripped. Empty if absent. */
	configPath: string;
	/** True when `configPath` no longer exists on disk — the orphan signal. */
	orphaned: boolean;
}

/** Matches the platform-split binaries this package ships. */
const TELEMETRY_BINARY = /telemetry-binaries-[a-z0-9-]+\/bin\/(jaeger|otelcol)\b/;
const CONFIG_ARG = /--config=(\S+)/;

/**
 * Every running jaeger/otelcol this package could have started.
 *
 * Uses `ps -eo pid=,args=`, which behaves the same on macOS and Linux. Returns
 * an empty list rather than throwing when `ps` is unavailable — a reap that
 * cannot enumerate must report "found nothing to do", not crash a health check.
 */
export function listTelemetryProcesses(): TelemetryProcess[] {
	let out: string;
	try {
		out = execFileSync("ps", ["-eo", "pid=,args="], {
			encoding: "utf-8",
			maxBuffer: 8 * 1024 * 1024,
		});
	} catch {
		return [];
	}

	const found: TelemetryProcess[] = [];
	for (const line of out.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "") continue;
		const binaryMatch = TELEMETRY_BINARY.exec(trimmed);
		if (!binaryMatch) continue;

		const space = trimmed.indexOf(" ");
		const pid = Number.parseInt(trimmed.slice(0, space), 10);
		if (!Number.isInteger(pid) || pid <= 0) continue;

		const configMatch = CONFIG_ARG.exec(trimmed);
		// jaeger is started as `--config=file:/path`; otelcol as `--config=/path`.
		const configPath = configMatch ? configMatch[1].replace(/^file:/, "") : "";

		found.push({
			pid,
			binary: binaryMatch[1],
			// No --config at all is NOT treated as orphaned: absence of evidence.
			// Killing something we cannot identify is worse than leaving it.
			orphaned: configPath !== "" && !existsSync(configPath),
			configPath,
		});
	}
	return found;
}

export interface ReapResult {
	/** Orphans identified, whether or not they were killed. */
	orphans: TelemetryProcess[];
	/** PIDs actually signalled. Empty when `dryRun`. */
	killed: number[];
	/** Orphans that survived the signal, with the reason. */
	failed: { pid: number; reason: string }[];
	/** PIDs skipped because the live registry claims them. */
	protectedPids: number[];
}

export interface ReapOptions {
	dryRun?: boolean;
	/**
	 * PIDs the current registry claims. Never signalled, even if their config
	 * path is missing — a running daemon whose config was deleted underneath it
	 * is a different problem, and killing the daemon the user is actively using
	 * is not this command's job.
	 */
	protectPids?: number[];
}

/**
 * Kill every orphaned telemetry process.
 *
 * SIGTERM only. These are collectors with no shutdown-critical state — a
 * SIGKILL escalation would buy nothing and risks leaving port bindings in
 * TIME_WAIT longer than the graceful path.
 */
export function reapOrphans(opts: ReapOptions = {}): ReapResult {
	const protectedPids = new Set(opts.protectPids ?? []);
	const all = listTelemetryProcesses();
	const orphans = all.filter((p) => p.orphaned && !protectedPids.has(p.pid));
	const skipped = all.filter((p) => p.orphaned && protectedPids.has(p.pid)).map((p) => p.pid);

	const killed: number[] = [];
	const failed: { pid: number; reason: string }[] = [];
	if (opts.dryRun) return { orphans, killed, failed, protectedPids: skipped };

	for (const proc of orphans) {
		try {
			process.kill(proc.pid, "SIGTERM");
			killed.push(proc.pid);
		} catch (err) {
			// ESRCH means it exited between listing and signalling — that is the
			// outcome we wanted, not a failure.
			const reason = (err as NodeJS.ErrnoException).code ?? String(err);
			if (reason === "ESRCH") killed.push(proc.pid);
			else failed.push({ pid: proc.pid, reason });
		}
	}
	return { orphans, killed, failed, protectedPids: skipped };
}
