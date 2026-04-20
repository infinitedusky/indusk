import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	daemonRestart,
	daemonStart,
	daemonStatus,
	daemonStop,
	isPortListening,
} from "../../lib/telemetry/daemon.js";
import {
	deregisterProject,
	readRegistry,
	registerProject,
} from "../../lib/telemetry/registry.js";

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
	writeFileSync(
		join(projectPath, ".mcp.json"),
		`${JSON.stringify(data, null, 2)}\n`,
	);
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

export interface TelemetryStartOptions {
	otlpPort: string;
	uiPort: string;
}

/**
 * Start the telemetry daemon (Jaeger + otelcol). If already running, prints
 * the current state without spawning a second set of processes.
 */
export async function telemetryStart(
	opts: TelemetryStartOptions,
): Promise<void> {
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
		console.info(
			`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`,
		);
		console.info(`  Logs:      ${meta.logsPath}`);
		console.info(`  Daemon log: ~/.indusk/telemetry.log`);
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

/**
 * Restart = stop + start. Picks up new binaries after `npm i -g` of a newer
 * indusk-mcp + new platform-package version (T5 contract).
 */
export async function telemetryRestart(
	opts: TelemetryStartOptions,
): Promise<void> {
	console.info("Restarting telemetry daemon...");
	try {
		const meta = await daemonRestart({
			otlpPort: Number.parseInt(opts.otlpPort, 10),
			uiPort: Number.parseInt(opts.uiPort, 10),
		});
		console.info(`  OTLP:      http://localhost:${meta.otlpPort}`);
		console.info(`  Jaeger UI: http://localhost:${meta.uiPort}`);
		console.info(
			`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`,
		);
	} catch (err) {
		console.error(
			`Failed to restart telemetry daemon: ${(err as Error).message}`,
		);
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
	const portSuffix =
		uiListening && otlpListening ? "" : " (port not yet accepting connections)";
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
			console.error(
				`Project registered but daemon failed to start: ${(err as Error).message}`,
			);
			process.exit(1);
		}
	}
	if (status.running) {
		upsertJaegerEntry(projectPath, status.mcpPort);
		console.info(
			`  .mcp.json: wired jaeger MCP server at http://localhost:${status.mcpPort}/mcp`,
		);
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
