import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	daemonRestart,
	daemonStart,
	daemonStatus,
	daemonStop,
	isPortListening,
} from "../../lib/telemetry/daemon.js";
import { deregisterProject, readRegistry, registerProject } from "../../lib/telemetry/registry.js";

/**
 * Read/write a project's `.mcp.json`, adding or removing the `jaeger` MCP
 * server pointer. This is how the agent gets access to Jaeger's bundled
 * MCP server (8 tools: search_traces, get_trace_topology, get_span_details,
 * get_services, etc.) without needing a dedicated indusk-mcp wrapper.
 *
 * Follows the dash0 pattern — extension enable writes an entry, disable
 * removes it. Daemon restart (which may auto-bump the mcpPort) refreshes
 * every registered project's entry.
 */
interface McpServerEntry {
	type?: string;
	url?: string;
	command?: string;
	args?: string[];
	[k: string]: unknown;
}
interface McpJson {
	mcpServers?: Record<string, McpServerEntry>;
}

function readMcpJson(projectPath: string): McpJson {
	const p = join(projectPath, ".mcp.json");
	if (!existsSync(p)) return { mcpServers: {} };
	try {
		return JSON.parse(readFileSync(p, "utf-8")) as McpJson;
	} catch {
		return { mcpServers: {} };
	}
}

function writeMcpJson(projectPath: string, data: McpJson): void {
	writeFileSync(join(projectPath, ".mcp.json"), `${JSON.stringify(data, null, 2)}\n`);
}

function upsertJaegerEntry(projectPath: string, mcpPort: number): void {
	const data = readMcpJson(projectPath);
	data.mcpServers = data.mcpServers ?? {};
	data.mcpServers.jaeger = {
		type: "http",
		url: `http://localhost:${mcpPort}/mcp`,
	};
	writeMcpJson(projectPath, data);
}

function removeJaegerEntry(projectPath: string): void {
	const p = join(projectPath, ".mcp.json");
	if (!existsSync(p)) return;
	const data = readMcpJson(projectPath);
	if (data.mcpServers?.jaeger) {
		delete data.mcpServers.jaeger;
		writeMcpJson(projectPath, data);
	}
}

/**
 * Re-write the `jaeger` MCP server entry across every registered project's
 * `.mcp.json` to point at the supplied `mcpPort`. Called after daemon
 * start / restart / register so every project's pointer stays in sync with
 * the live OS-assigned port (which rotates on every spawn).
 *
 * Silently skips projects whose path no longer exists on disk (admin-UI
 * lesson: registry is never auto-pruned — a deleted project path is a user
 * recovery action, not something to crash the daemon over). Returns counts
 * so callers can surface what happened.
 */
function reportMcpSync(result: { updated: number; skipped: string[] }, mcpPort: number): void {
	if (result.updated > 0) {
		console.info(
			`  .mcp.json: synced ${result.updated} registered project(s) to mcpPort :${mcpPort}`,
		);
	}
	if (result.skipped.length > 0) {
		console.warn(
			`  Skipped ${result.skipped.length} project(s) (missing path or write failed): ${result.skipped.join(", ")}`,
		);
	}
}

function syncAllRegisteredProjectsMcp(mcpPort: number): {
	updated: number;
	skipped: string[];
} {
	const skipped: string[] = [];
	let updated = 0;
	for (const p of readRegistry().projects) {
		if (!existsSync(p.path)) {
			skipped.push(p.name);
			continue;
		}
		try {
			upsertJaegerEntry(p.path, mcpPort);
			updated++;
		} catch (err) {
			skipped.push(`${p.name} (${(err as Error).message})`);
		}
	}
	return { updated, skipped };
}

export interface TelemetryStartOptions {
	otlpPort: string;
	uiPort: string;
}

/**
 * Start the telemetry daemon (Jaeger + otelcol). If already running, prints
 * the current state without spawning a second set of processes.
 */
export async function telemetryStart(opts: TelemetryStartOptions): Promise<void> {
	const status = await daemonStatus();
	if (status.running) {
		console.info(
			`Telemetry daemon is already running:\n` +
				`  OTLP:      http://localhost:${status.otlpPort}\n` +
				`  Jaeger UI: http://localhost:${status.uiPort}\n` +
				`  PIDs:      jaeger=${status.jaegerPid} otelcol=${status.otelcolPid}`,
		);
		return;
	}

	const otlpRequested = Number.parseInt(opts.otlpPort, 10);
	const uiRequested = Number.parseInt(opts.uiPort, 10);
	if (!Number.isFinite(otlpRequested) || otlpRequested < 0 || otlpRequested > 65535) {
		console.error(`Invalid --otlp-port: ${opts.otlpPort}`);
		process.exit(1);
	}
	if (!Number.isFinite(uiRequested) || uiRequested < 0 || uiRequested > 65535) {
		console.error(`Invalid --ui-port: ${opts.uiPort}`);
		process.exit(1);
	}

	console.info("Starting telemetry daemon (Jaeger + otelcol)...");
	try {
		const meta = await daemonStart({
			otlpPort: otlpRequested,
			uiPort: uiRequested,
		});
		console.info(`  OTLP:      http://localhost:${meta.otlpPort}`);
		console.info(`  Jaeger UI: http://localhost:${meta.uiPort}`);
		console.info(`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`);
		console.info(`  Logs:      ${meta.logsPath}`);
		console.info(`  Daemon log: ~/.indusk/telemetry.log`);
		reportMcpSync(syncAllRegisteredProjectsMcp(meta.mcpPort), meta.mcpPort);
	} catch (err) {
		console.error(`Failed to start telemetry daemon: ${(err as Error).message}`);
		process.exit(1);
	}
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

export interface TelemetryRestartOptions {
	otlpPort?: string;
	uiPort?: string;
}

/**
 * Restart = stop + start. Picks up new binaries after `npm i -g` of a newer
 * indusk-mcp + new platform-package version (T5 contract). When ports are not
 * explicitly supplied, `daemonRestart` inherits them from the previously
 * running daemon's meta file — restart means "same daemon, fresh processes."
 */
export async function telemetryRestart(opts: TelemetryRestartOptions = {}): Promise<void> {
	console.info("Restarting telemetry daemon...");
	try {
		const meta = await daemonRestart({
			otlpPort: opts.otlpPort !== undefined ? Number.parseInt(opts.otlpPort, 10) : undefined,
			uiPort: opts.uiPort !== undefined ? Number.parseInt(opts.uiPort, 10) : undefined,
		});
		console.info(`  OTLP:      http://localhost:${meta.otlpPort}`);
		console.info(`  Jaeger UI: http://localhost:${meta.uiPort}`);
		console.info(`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`);
		reportMcpSync(syncAllRegisteredProjectsMcp(meta.mcpPort), meta.mcpPort);
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
	const status = await daemonStatus();
	const projectCount = readRegistry().projects.length;
	const projectLabel = projectCount === 1 ? "project" : "projects";

	if (!status.running) {
		console.info("Telemetry daemon: not running");
		console.info(`Registered ${projectLabel} ${projectCount}`);
		return;
	}

	const uiListening = await isPortListening(status.uiPort);
	const otlpListening = await isPortListening(status.otlpPort);
	const portSuffix = uiListening && otlpListening ? "" : " (port not yet accepting connections)";
	console.info(`Telemetry daemon: running${portSuffix}`);
	console.info(`  OTLP:      http://localhost:${status.otlpPort}`);
	console.info(`  Jaeger UI: http://localhost:${status.uiPort}`);
	console.info(`  PIDs:      jaeger=${status.jaegerPid} otelcol=${status.otelcolPid}`);
	console.info(`  Started:   ${status.startedAt}`);
	console.info(`Registered ${projectLabel} ${projectCount}`);
}

/**
 * Register a project with the telemetry daemon (internal — called by the
 * extension's on_enable hook). If the daemon isn't running, auto-starts it
 * so the newly-registered project has a live daemon to emit to. Also
 * upserts a `jaeger` MCP server entry in the project's `.mcp.json` pointing
 * at the daemon's current mcpPort — giving the agent direct access to
 * Jaeger's 8 MCP tools (search_traces, get_trace_topology, get_span_details,
 * etc.).
 */
export async function telemetryRegister(projectPath: string): Promise<void> {
	const entry = registerProject(projectPath);
	console.info(`Registered project: ${entry.name} (${entry.path})`);
	let status = await daemonStatus();
	if (!status.running) {
		console.info("Daemon not running — starting it now...");
		try {
			const meta = await daemonStart({});
			console.info(`  OTLP:      http://localhost:${meta.otlpPort}`);
			console.info(`  Jaeger UI: http://localhost:${meta.uiPort}`);
			console.info(`  Jaeger MCP: http://localhost:${meta.mcpPort}/mcp`);
			status = { running: true, ...meta };
		} catch (err) {
			console.error(`Project registered but daemon failed to start: ${(err as Error).message}`);
			process.exit(1);
		}
	}
	if (status.running) {
		// Sync ALL registered projects (not just this one) — daemon's mcpPort
		// is OS-assigned per spawn, so other projects' .mcp.json may be stale
		// from a previous daemon run.
		const result = syncAllRegisteredProjectsMcp(status.mcpPort);
		console.info(`  .mcp.json: wired jaeger MCP server at http://localhost:${status.mcpPort}/mcp`);
		const others = Math.max(0, result.updated - 1);
		if (others > 0) {
			console.info(
				`  Refreshed ${others} other registered project(s)' .mcp.json to the same mcpPort`,
			);
		}
		if (result.skipped.length > 0) {
			console.warn(
				`  Skipped ${result.skipped.length} project(s) (missing path or write failed): ${result.skipped.join(", ")}`,
			);
		}
	}
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
	const status = await daemonStatus();
	if (!status.running) {
		console.error("Telemetry daemon is not running. Run `indusk telemetry start`.");
		process.exit(1);
	}
	const url = `http://localhost:${status.uiPort}/api/traces/${traceId}`;
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
	const status = await daemonStatus();
	if (!status.running) {
		console.error("Telemetry daemon is not running. Run `indusk telemetry start`.");
		process.exit(1);
	}
	const url = `http://localhost:${status.uiPort}/api/services`;
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
 * Reset the daemon: stop + restart with fresh in-memory Jaeger storage +
 * truncate logs.jsonl. Human-triggered only; not exposed as an MCP tool.
 */
export async function telemetryReset(opts: TelemetryStartOptions): Promise<void> {
	const { existsSync, writeFileSync } = await import("node:fs");
	const { homedir } = await import("node:os");
	const { join } = await import("node:path");
	console.info("Stopping daemon + clearing buffers...");
	await daemonStop();
	const logsPath = join(
		process.env.INDUSK_HOME ?? join(homedir(), ".indusk"),
		"telemetry",
		"logs.jsonl",
	);
	if (existsSync(logsPath)) writeFileSync(logsPath, "");
	try {
		const meta = await daemonStart({
			otlpPort: Number.parseInt(opts.otlpPort, 10),
			uiPort: Number.parseInt(opts.uiPort, 10),
		});
		console.info("Daemon restarted with fresh buffers.");
		console.info(`  OTLP:      http://localhost:${meta.otlpPort}`);
		console.info(`  Jaeger UI: http://localhost:${meta.uiPort}`);
		reportMcpSync(syncAllRegisteredProjectsMcp(meta.mcpPort), meta.mcpPort);
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
