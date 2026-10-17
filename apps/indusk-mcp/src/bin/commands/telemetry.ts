import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readMcpJson, removeJaegerEntry, upsertJaegerEntry } from "../../lib/mcp-config.js";
import { daemonRestart, daemonStop, startDaemon } from "../../lib/telemetry/daemon.js";
import { addressReport, resetAddress } from "../../lib/telemetry/daemon-address.js";
import { realDaemonReads } from "../../lib/telemetry/daemon-reads.js";
import { daemonReports } from "../../lib/telemetry/daemon-reports.js";
import {
	daemonState,
	describeFinding,
	findDaemon,
	renderSelfTracing,
	renderStatus,
	selfTracingSince,
} from "../../lib/telemetry/daemon-state.js";
import { runReap } from "../../lib/telemetry/reap-plan.js";
import { registerWithDaemon } from "../../lib/telemetry/register.js";
import { deregisterProject, readRegistry } from "../../lib/telemetry/registry.js";
import { describeDaemon, startReport } from "../../lib/telemetry/start-plan.js";
import { induskHome, portAnswers, resolveLocalDaemonHere } from "../../lib/telemetry/status.js";
import { realStopDeps } from "../../lib/telemetry/stop.js";

/**
 * Re-point the registered projects whose `jaeger` entry names exactly the MCP
 * port the daemon had before a restart. A restart on the stored address keeps
 * the port, so nothing is written; an entry that names any other port was set
 * by someone else and is left as it is.
 */
function repointMcpEntries(oldPort: number, newPort: number): void {
	if (oldPort <= 0 || oldPort === newPort) return;
	let updated = 0;
	for (const p of readRegistry().projects) {
		if (!existsSync(p.path)) continue;
		if (readMcpJson(p.path).mcpServers?.jaeger?.url !== `http://localhost:${oldPort}/mcp`) continue;
		if (upsertJaegerEntry(p.path, newPort)) updated++;
	}
	if (updated > 0)
		console.info(`  .mcp.json: re-pointed ${updated} project(s) to MCP port :${newPort}`);
}

export interface TelemetryStartOptions {
	otlpPort?: string;
	uiPort?: string;
	logsPort?: string;
	mcpPort?: string;
}

/** Ports from the command line: each is an integer 0-65535 or the command exits. */
function portOptions(opts: TelemetryStartOptions): {
	otlpPort?: number;
	uiPort?: number;
	logsPort?: number;
	mcpPort?: number;
} {
	const out: Record<string, number> = {};
	for (const [key, flag] of [
		["otlpPort", "--otlp-port"],
		["uiPort", "--ui-port"],
		["logsPort", "--logs-port"],
		["mcpPort", "--mcp-port"],
	] as const) {
		const raw = opts[key];
		if (raw === undefined) continue;
		const port = Number.parseInt(raw, 10);
		if (!Number.isFinite(port) || port < 0 || port > 65535) {
			console.error(`Invalid ${flag}: ${raw}`);
			process.exit(1);
		}
		out[key] = port;
	}
	return out;
}

/**
 * Start the telemetry daemon (Jaeger + otelcol): reports one that runs, takes
 * over one whose record is lost, starts one on the stored address, or refuses
 * naming the holder of a port. Never a second daemon.
 */
export async function telemetryStart(opts: TelemetryStartOptions): Promise<void> {
	const given = portOptions(opts);
	try {
		const out = startReport(await startDaemon("start", given));
		console[out.code === 0 ? "info" : "error"](out.text);
		if (out.code !== 0) process.exit(out.code);
	} catch (err) {
		console.error(`Failed to start telemetry daemon: ${(err as Error).message}`);
		process.exit(1);
	}
}

export interface TelemetryReapOptions {
	dryRun?: boolean;
}

/**
 * Stop this home's strays: daemon processes of this home the record does not
 * name, whether or not their config file is still there. Never the recorded
 * daemon, another home's, a test's, or a process that is not InDusk's.
 */
export async function telemetryReap(opts: TelemetryReapOptions = {}): Promise<void> {
	const home = induskHome();
	const out = await runReap(realDaemonReads(home), home, realStopDeps, { dryRun: opts.dryRun });
	console[out.code === 0 ? "info" : "error"](out.text);
	if (out.code !== 0) process.exitCode = out.code;
}

/**
 * Stop the telemetry daemon. Reports whether it was running, the PIDs it
 * signaled, and whether SIGKILL was required.
 */
export async function telemetryStop(): Promise<void> {
	const result = await daemonStop();
	if (!result.stopped) {
		console.info("Telemetry daemon is not running.");
		return;
	}
	if (result.stillRunning && result.stillRunning.length > 0) {
		console.error(
			`Telemetry daemon did not stop: ${result.stillRunning.join(", ")} still running after SIGKILL. Its record is kept; stop ${result.stillRunning.length === 1 ? "it" : "them"} by hand.`,
		);
		process.exitCode = 1;
		return;
	}
	if (result.usedSigkill) {
		console.warn(
			`Telemetry daemon (jaeger=${result.signaledJaegerPid} otelcol=${result.signaledOtelcolPid}) did not exit within 3s; forced with SIGKILL.`,
		);
	} else {
		console.info(
			`Telemetry daemon stopped (jaeger=${result.signaledJaegerPid} otelcol=${result.signaledOtelcolPid}).`,
		);
	}
}

export type TelemetryRestartOptions = TelemetryStartOptions;

/**
 * Restart = stop + start on the same address. The real home comes back on its
 * stored address, a temporary home on the ports it held; picks up new binaries
 * after `npm i -g` of a newer indusk-mcp + new platform-package version.
 */
export async function telemetryRestart(opts: TelemetryRestartOptions = {}): Promise<void> {
	console.info("Restarting telemetry daemon...");
	try {
		const given = portOptions(opts);
		// A daemon whose record is gone is found first (and its record written), so stop can see it.
		const before = await resolveLocalDaemonHere("telemetry restart");
		const meta = await daemonRestart(given);
		console.info(describeDaemon(meta));
		repointMcpEntries(before?.mcpPort ?? 0, meta.mcpPort);
	} catch (err) {
		console.error(`Failed to restart telemetry daemon: ${(err as Error).message}`);
		process.exit(1);
	}
}

/**
 * Report daemon running/not, both ports, both PIDs, started-at, registered
 * project count (read from the registry at `~/.indusk/telemetry/projects.json`).
 */
export async function telemetryStatus(): Promise<void> {
	const home = induskHome();
	const reads = realDaemonReads(home);
	let state = daemonState(reads, home);
	let finding: string | null = null;
	if (state.kind === "found") {
		const found = await findDaemon(reads, home, "status");
		if (found !== null) {
			state = daemonState(reads, home);
			finding = describeFinding(found);
		}
	}
	const answers =
		state.meta !== null && state.kind === "running" ? await portAnswers(state.meta) : {};
	const projectCount = readRegistry().projects.length;
	const projectLabel = projectCount === 1 ? "project" : "projects";

	for (const line of renderStatus(state, answers)) console.info(line);
	if (finding !== null) console.info(finding);
	if (state.meta !== null && (state.kind === "running" || state.kind === "partial")) {
		const tracing = selfTracingSince(reads, state.meta);
		for (const line of renderSelfTracing(tracing)) console.info(line);
		// Status knows the answer now: tell the daemon whether it holds its own ports and its log is readable.
		if (state.kind === "running") {
			await reads.report?.(
				state.meta.otlpPort,
				daemonReports("status", { ...state, selfTracing: tracing }),
			);
		}
	}
	console.info(`Registered ${projectLabel} ${projectCount}`);
}

/**
 * Register a project with the telemetry daemon (internal — called by the
 * extension's on_enable hook, and so by `init`, `update` and enabling it).
 * Takes over or starts the one daemon, never a second, and writes only this
 * project's `jaeger` MCP entry, at the stored MCP port, when it differs.
 */
export async function telemetryRegister(projectPath: string): Promise<void> {
	const result = await registerWithDaemon(projectPath);
	for (const line of result.lines) {
		console[result.code === 0 ? "info" : "error"](line);
	}
	if (result.code !== 0) process.exit(result.code);
}

/**
 * Print the stored address (`--json` for `init` to hand to an application), or
 * choose it again on purpose (`--reset`), the one way it ever changes.
 */
export async function telemetryAddress(opts: { json?: boolean; reset?: boolean }): Promise<void> {
	const home = induskHome();
	const reads = realDaemonReads(home);
	if (opts.reset) {
		const { findFreePort } = await import("../../lib/telemetry/daemon.js");
		const spare = await Promise.all([0, 0, 0, 0].map(() => findFreePort(0)));
		const result = resetAddress(reads, home, spare);
		console[result.ok ? "info" : "error"](result.message);
		if (!result.ok) process.exit(1);
		return;
	}
	const out = addressReport(reads, { json: opts.json });
	console[out.code === 0 ? "info" : "error"](out.text);
	if (out.code !== 0) process.exit(out.code);
}

/**
 * Human-facing terminal: tail recent logs from the log sink. Same filters
 * as the MCP `tail_logs` tool, printed as text lines instead of JSON.
 */
export interface TelemetryTailOptions {
	service?: string;
	level: "error" | "warn" | "info" | "debug" | "any";
	sinceMinutes: string;
	limit: string;
}

export async function telemetryTail(opts: TelemetryTailOptions): Promise<void> {
	const since = Number.parseInt(opts.sinceMinutes, 10) || 5;
	const lim = Number.parseInt(opts.limit, 10) || 50;
	const { existsSync, readFileSync } = await import("node:fs");
	const { homedir } = await import("node:os");
	const { join } = await import("node:path");
	const path = join(
		process.env.INDUSK_HOME ?? join(homedir(), ".indusk"),
		"telemetry",
		"logs.jsonl",
	);
	if (!existsSync(path)) {
		console.info("No log sink yet. Emit some logs or start the daemon.");
		return;
	}
	const raw = readFileSync(path, "utf-8");
	const windowStart = Date.now() - since * 60_000;
	const levelRank: Record<string, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};
	const minRank = opts.level === "any" ? -1 : (levelRank[opts.level] ?? -1);
	const matches: string[] = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			continue;
		}
		const rls = Array.isArray(parsed.resourceLogs) ? parsed.resourceLogs : [];
		for (const rl of rls) {
			if (!rl || typeof rl !== "object") continue;
			const rlObj = rl as Record<string, unknown>;
			const res = (rlObj.resource ?? {}) as Record<string, unknown>;
			const resAttrs = Array.isArray(res.attributes)
				? (res.attributes as Array<Record<string, unknown>>)
				: [];
			const svc =
				(
					resAttrs.find((a) => a.key === "service.name")?.value as {
						stringValue?: string;
					}
				)?.stringValue ?? "-";
			if (opts.service && svc !== opts.service) continue;
			const sls = Array.isArray(rlObj.scopeLogs) ? rlObj.scopeLogs : [];
			for (const sl of sls) {
				if (!sl || typeof sl !== "object") continue;
				const lrs = Array.isArray((sl as Record<string, unknown>).logRecords)
					? ((sl as Record<string, unknown>).logRecords as Array<Record<string, unknown>>)
					: [];
				for (const lr of lrs) {
					const timeNs =
						typeof lr.timeUnixNano === "string"
							? Number(lr.timeUnixNano)
							: Number(lr.timeUnixNano ?? Date.now() * 1_000_000);
					const ts = new Date(timeNs / 1_000_000);
					if (ts.getTime() < windowStart) continue;
					const sev =
						typeof lr.severityText === "string" ? (lr.severityText as string).toLowerCase() : "-";
					if (minRank >= 0) {
						const r = levelRank[sev] ?? -1;
						if (r < minRank) continue;
					}
					const body =
						(lr.body as { stringValue?: string } | undefined)?.stringValue ??
						JSON.stringify(lr.body ?? {});
					matches.push(
						`${ts.toISOString()} [${sev.toUpperCase().padEnd(5)}] ${svc.padEnd(20)} ${body}`,
					);
				}
			}
		}
	}
	const out = matches.slice(-lim);
	if (out.length === 0) {
		console.info(
			`No log records in the last ${since} minute(s)${opts.service ? ` for service=${opts.service}` : ""}${opts.level !== "any" ? ` at level>=${opts.level}` : ""}.`,
		);
		return;
	}
	for (const line of out) console.info(line);
	if (matches.length > out.length) {
		console.info(
			`\n(showing last ${out.length} of ${matches.length} matching records — raise --limit to see more)`,
		);
	}
}

/**
 * Print the full span tree for a trace ID, via Jaeger's REST query API.
 */
export async function telemetryTrace(traceId: string): Promise<void> {
	const daemon = await resolveLocalDaemonHere("telemetry trace");
	if (daemon === null) {
		console.error("Telemetry daemon is not running. Run `indusk telemetry start`.");
		process.exit(1);
	}
	const url = `http://localhost:${daemon.uiPort}/api/traces/${traceId}`;
	try {
		const res = await fetch(url);
		if (!res.ok) {
			console.error(`Jaeger returned ${res.status} for ${url}`);
			process.exit(1);
		}
		const body = await res.json();
		console.info(JSON.stringify(body, null, 2));
	} catch (err) {
		console.error(`Failed to fetch trace: ${(err as Error).message}`);
		process.exit(1);
	}
}

/**
 * Print the list of services the daemon has seen, one per line.
 */
export async function telemetryServices(): Promise<void> {
	const daemon = await resolveLocalDaemonHere("telemetry services");
	if (daemon === null) {
		console.error("Telemetry daemon is not running. Run `indusk telemetry start`.");
		process.exit(1);
	}
	const url = `http://localhost:${daemon.uiPort}/api/services`;
	try {
		const res = await fetch(url);
		if (!res.ok) {
			console.error(`Jaeger returned ${res.status} for ${url}`);
			process.exit(1);
		}
		const body = (await res.json()) as { data?: string[] };
		if (!body.data || body.data.length === 0) {
			console.info("(no services have emitted traces yet)");
			return;
		}
		for (const s of body.data) console.info(s);
	} catch (err) {
		console.error(`Failed to fetch services: ${(err as Error).message}`);
		process.exit(1);
	}
}

/**
 * Reset the daemon: stop + restart on the same address with fresh in-memory
 * Jaeger storage + truncate logs.jsonl. Human-triggered only; not exposed as an
 * MCP tool.
 */
export async function telemetryReset(opts: TelemetryStartOptions): Promise<void> {
	console.info("Stopping daemon + clearing buffers...");
	// A daemon whose record is gone is found first (and its record written), so stop can see it.
	await resolveLocalDaemonHere("telemetry reset");
	const logsPath = join(induskHome(), "telemetry", "logs.jsonl");
	try {
		const meta = await daemonRestart(portOptions(opts), {
			onStopped: () => {
				if (existsSync(logsPath)) writeFileSync(logsPath, "");
			},
		});
		console.info("Daemon restarted with fresh buffers.");
		console.info(describeDaemon(meta));
	} catch (err) {
		console.error(`Reset failed: ${(err as Error).message}`);
		process.exit(1);
	}
}

/**
 * Deregister a project (internal — called by the extension's on_disable hook).
 * Removes the `jaeger` MCP server entry from the project's `.mcp.json`. If
 * the registry becomes empty, gracefully stops the daemon.
 */
export async function telemetryDeregister(projectPath: string): Promise<void> {
	const removed = deregisterProject(projectPath);
	if (!removed) {
		console.info(`Project not registered: ${projectPath}`);
		return;
	}
	removeJaegerEntry(projectPath);
	console.info(`Deregistered project: ${projectPath}`);
	const reg = readRegistry();
	if (reg.projects.length === 0) {
		console.info("Last project disabled — stopping daemon...");
		await daemonStop();
	}
}
