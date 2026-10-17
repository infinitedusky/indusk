import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { join } from "node:path";

/**
 * The telemetry daemon: two long-lived processes — Jaeger (traces end-to-end)
 * and otelcol (logs-only pipeline → file sink). Supervised as a unit; stop
 * kills both, status reports both, restart respawns both.
 *
 * Lifecycle is managed via three files under `~/.indusk/` (or `$INDUSK_HOME/`
 * during tests):
 *
 *   telemetry.pid   — bare Jaeger PID (the "primary" process) for liveness
 *                     probing via `kill(pid, 0)`. otelcol PID also tracked,
 *                     but in the JSON meta file — one primary PID is the
 *                     admin-UI convention we inherit here.
 *   telemetry.json  — richer metadata: both PIDs, both ports, startedAt,
 *                     binary paths, platform
 *   telemetry.log   — interleaved stdout+stderr from both detached children
 *
 * Both processes survive terminal close via `detached: true` + `unref()`
 * + `stdio: ["ignore", logFd, logFd]`. The parent process is free to exit
 * immediately after `daemonStart` resolves — the PID/meta files are the
 * durable handoff to subsequent `telemetry status`/`telemetry stop` invocations.
 *
 * PID-reuse hardening: `status` and `stop` both judge a recorded process by
 * its command line (`daemon-state.ts`, `stop.ts`), never by a port: a slow
 * port must never make a read lose the daemon. Only `stop` removes the record.
 */

import { realProcessReads } from "../process-identity.js";
import { ADDRESS_ROLES, type Ports } from "./daemon-address.js";
import { homeKind, realTempRoots } from "./daemon-process.js";
import { realDaemonReads } from "./daemon-reads.js";
import { daemonState } from "./daemon-state.js";
import {
	type DaemonStartOptions,
	type EnsureResult,
	ensureDaemon,
	restartPorts,
	startOptions,
} from "./start-plan.js";
import {
	cleanupFiles,
	type DaemonMeta,
	induskHome,
	isPortListening,
	metaFilePath,
} from "./status.js";
import { stopDaemon } from "./stop.js";

export type { DaemonStartOptions } from "./start-plan.js";
export {
	type DaemonMeta,
	type DaemonStatusResult,
	daemonMetaPath,
	daemonStatus,
	isPortListening,
	liveOtlpEndpointSync,
} from "./status.js";

function logFilePath(): string {
	return join(induskHome(), "telemetry.log");
}

function ensureHome(): void {
	const h = induskHome();
	if (!existsSync(h)) mkdirSync(h, { recursive: true });
}

export interface DaemonStopResult {
	stopped: boolean;
	signaledJaegerPid?: number;
	signaledOtelcolPid?: number;
	usedSigkill?: boolean;
	/** Its own processes still running after the stop; the record is kept while any are. */
	stillRunning?: number[];
}

// ---- platform + binary resolution ------------------------------------------

function currentPlatformTag(): string {
	const os = process.platform;
	const arch = process.arch === "x64" ? "x64" : process.arch;
	return `${os}-${arch}`;
}

/**
 * Resolve the path to a bundled binary via npm's optional-deps package
 * resolution. Throws a user-facing error if the platform package isn't
 * installed (unsupported platform, or `npm install` hasn't run).
 */
export function resolveBinary(name: "jaeger" | "otelcol"): string {
	const require = createRequire(import.meta.url);
	const platformTag = currentPlatformTag();
	const pkgName = `@infinitedusky/telemetry-binaries-${platformTag}`;
	try {
		return require.resolve(`${pkgName}/bin/${name}`);
	} catch (err) {
		throw new Error(
			`Could not resolve ${name} binary for platform ${platformTag}. ` +
				`The platform package ${pkgName} is not installed — either your ` +
				`platform is unsupported (currently supported: darwin-arm64/x64, ` +
				`linux-arm64/x64) or the install didn't land the optional dep. ` +
				`Run \`npm install\` / \`pnpm install\` and try again. ` +
				`Underlying: ${(err as Error).message}`,
		);
	}
}

// ---- port helpers ----------------------------------------------------------

export async function findFreePort(requested: number): Promise<number> {
	if (requested === 0) return pickAnyFreePort();
	if (await isPortFree(requested)) return requested;
	return pickAnyFreePort();
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
		// Bind without host so we test the same wildcard scope Jaeger/otelcol use.
		// Binding to 127.0.0.1 falsely reports "free" when another process holds
		// the port via an IPv6 wildcard (`::`) bind without IPV6_V6ONLY — which
		// is the default for `net.createServer` and what Jaeger does internally.
		s.listen(port);
	});
}

// ---- identity + lifecycle --------------------------------------------------

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function waitForPortListening(port: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await isPortListening(port)) return true;
		await sleep(100);
	}
	return false;
}

// Poll until a port is rebind-able (or timeout). After `daemonStop()` the OS
// can hold the just-released socket in TIME_WAIT / cleanup for hundreds of ms
// to a couple of seconds; without this, `daemonRestart` would race and find
// its own stored port still held.
async function waitForPortFree(port: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await isPortFree(port)) return true;
		await sleep(100);
	}
	return false;
}

// ---- config file rendering -------------------------------------------------

/**
 * Render an inline Jaeger config with the auto-picked ports. We render a
 * fresh config per spawn rather than rely on the shipped jaeger-config.yaml
 * so ports can be substituted. Shape matches
 * `packages/telemetry-binaries-shared/jaeger-config.yaml` including the
 * self-metrics-off setting (`service.telemetry.metrics.level: none`).
 */
function renderJaegerConfig(ports: {
	otlpHttp: number;
	otlpGrpc: number;
	ui: number;
	uiGrpc: number;
	health: number;
	mcp: number;
}): string {
	return `service:
  extensions: [jaeger_storage, jaeger_query, jaeger_mcp, healthcheckv2]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger_storage_exporter]
  telemetry:
    resource:
      service.name: jaeger
    metrics:
      level: none

extensions:
  healthcheckv2:
    use_v2: true
    http:
      endpoint: 0.0.0.0:${ports.health}
  jaeger_storage:
    backends:
      some_storage:
        memory:
          max_traces: 100000
  jaeger_query:
    storage:
      traces: some_storage
    http:
      endpoint: 0.0.0.0:${ports.ui}
    grpc:
      endpoint: 0.0.0.0:${ports.uiGrpc}
  jaeger_mcp:
    http:
      endpoint: 0.0.0.0:${ports.mcp}

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:${ports.otlpGrpc}
      http:
        endpoint: 0.0.0.0:${ports.otlpHttp}
        # CORS for browser-origin OTLP POSTs. Without this, every
        # /v1/traces request from a webapp fails preflight and no
        # browser-side spans land in Jaeger. Wildcard is safe here because
        # InDusk telemetry is a developer-machine local tool (Jaeger binds
        # to 0.0.0.0 already; the network boundary is the dev's loopback,
        # not the internet). Projects with stricter needs can override via
        # a future user-configurable hook.
        cors:
          allowed_origins:
            - "*"
          allowed_headers: ["*"]

processors:
  batch: {}

exporters:
  jaeger_storage_exporter:
    trace_storage: some_storage
`;
}

/**
 * Render an inline otelcol config (logs-only pipeline). Mirrors
 * `packages/telemetry-binaries-shared/collector-config.yaml` with the log
 * sink path templated.
 */
function renderCollectorConfig(
	ports: {
		otlpHttp: number;
		health: number;
	},
	logsPath: string,
): string {
	return `receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:${ports.otlpHttp}

processors:
  batch:
    send_batch_size: 512
    timeout: 2s
  memory_limiter:
    check_interval: 1s
    limit_mib: 256
    spike_limit_mib: 64

exporters:
  file/logs:
    path: ${logsPath}
    rotation:
      max_megabytes: 10
      max_backups: 5
    format: json

extensions:
  health_check:
    endpoint: 0.0.0.0:${ports.health}

service:
  extensions: [health_check]
  pipelines:
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [file/logs]
  telemetry:
    metrics:
      level: none
    logs:
      level: warn
`;
}

// ---- daemonStart / daemonStop / daemonRestart --------------------------------

/**
 * Thrown when a start is refused because a port it needs is held by a process
 * that is not this daemon's.
 *
 * Typed so callers can tell it apart from a real start failure: an explicit
 * `telemetry start` surfaces it and stops, but registering a project records
 * the project and prints it rather than failing the whole command.
 */
export class PortsOccupiedError extends Error {
	readonly ports: { name: string; port: number }[];
	constructor(message: string, ports: { name: string; port: number }[]) {
		super(message);
		this.name = "PortsOccupiedError";
		this.ports = ports;
	}
}

/** `n` free ports, picked together so no two are the same. */
async function pickFreePorts(n: number): Promise<number[]> {
	return Promise.all(Array.from({ length: n }, () => pickAnyFreePort()));
}

/**
 * Spawns Jaeger and the collector on the ports a start decided on (0 for a role
 * means any free port, which a temporary home asks for), waits for both to be
 * ready, and returns the record for the caller to write. Decides nothing: what
 * to start, and whether to, is `ensureDaemon`'s.
 */
export async function spawnDaemonProcesses(request: { ports: Ports }): Promise<DaemonMeta> {
	ensureHome();
	const jaegerBin = resolveBinary("jaeger");
	const otelcolBin = resolveBinary("otelcol");
	const { ports } = request;

	// Pick every port simultaneously to avoid sequential-pickFreePort collision
	// (see telemetry-ui-reachable.test.ts lesson from Phase 2).
	const [otlpHttp, logsOtlp, ui, mcp, otlpGrpc, uiGrpc, jaegerHealth, otelcolHealth] =
		await Promise.all([
			...ADDRESS_ROLES.map((role) => (ports[role] === 0 ? pickAnyFreePort() : ports[role])),
			pickAnyFreePort(),
			pickAnyFreePort(),
			pickAnyFreePort(),
			pickAnyFreePort(),
		]);

	// Write configs to INDUSK_HOME/telemetry-{jaeger,collector}.yaml right before
	// the spawn, so they survive parent exit, are inspectable post-mortem, and
	// name the ports the processes are about to hold.
	const jaegerConfig = join(induskHome(), "telemetry-jaeger.yaml");
	const collectorConfig = join(induskHome(), "telemetry-collector.yaml");
	const logsPath = join(induskHome(), "telemetry", "logs.jsonl");
	mkdirSync(join(induskHome(), "telemetry"), { recursive: true });

	writeFileSync(
		jaegerConfig,
		renderJaegerConfig({
			otlpHttp,
			otlpGrpc,
			ui,
			uiGrpc,
			health: jaegerHealth,
			mcp,
		}),
	);
	writeFileSync(
		collectorConfig,
		renderCollectorConfig({ otlpHttp: logsOtlp, health: otelcolHealth }, logsPath),
	);

	const logFd = openSync(logFilePath(), "a");

	// Spawn Jaeger first
	const jaegerChild = spawn(jaegerBin, [`--config=file:${jaegerConfig}`], {
		detached: true,
		stdio: ["ignore", logFd, logFd],
	});
	jaegerChild.unref();
	if (typeof jaegerChild.pid !== "number") {
		throw new Error("Jaeger spawn did not produce a PID");
	}

	// Wait for Jaeger health port so otelcol has a live upstream when it starts
	const jaegerReady = await waitForPortListening(jaegerHealth, 15_000);
	if (!jaegerReady) {
		try {
			process.kill(jaegerChild.pid, "SIGTERM");
		} catch {
			// already dead
		}
		throw new Error(
			`Jaeger did not become ready on health port :${jaegerHealth} within 15s. See ${logFilePath()} for details.`,
		);
	}

	// Spawn otelcol (logs-only pipeline)
	const otelcolChild = spawn(otelcolBin, [`--config=${collectorConfig}`], {
		detached: true,
		stdio: ["ignore", logFd, logFd],
	});
	otelcolChild.unref();
	if (typeof otelcolChild.pid !== "number") {
		try {
			process.kill(jaegerChild.pid, "SIGTERM");
		} catch {
			// already dead
		}
		throw new Error("otelcol spawn did not produce a PID");
	}

	const otelcolReady = await waitForPortListening(otelcolHealth, 15_000);
	if (!otelcolReady) {
		try {
			process.kill(otelcolChild.pid, "SIGTERM");
			process.kill(jaegerChild.pid, "SIGTERM");
		} catch {
			// best-effort
		}
		throw new Error(
			`otelcol did not become ready on health port :${otelcolHealth} within 15s. See ${logFilePath()} for details.`,
		);
	}

	return {
		jaegerPid: jaegerChild.pid,
		otelcolPid: otelcolChild.pid,
		otlpPort: otlpHttp,
		uiPort: ui,
		mcpPort: mcp,
		jaegerHealthPort: jaegerHealth,
		otelcolHealthPort: otelcolHealth,
		logsOtlpPort: logsOtlp,
		startedAt: new Date().toISOString(),
		jaegerBinary: jaegerBin,
		otelcolBinary: otelcolBin,
		platform: currentPlatformTag(),
		logsPath,
	};
}

/**
 * Start the daemon in this home the one way: report, take over, start on the
 * stored address (choosing it first when none is stored) or refuse naming the
 * holder of a port. `by` names the command that asks.
 */
export async function startDaemon(
	by: string,
	opts: DaemonStartOptions = {},
): Promise<EnsureResult> {
	ensureHome();
	const home = induskHome();
	const reads = realDaemonReads(home);
	const given = startOptions(opts, home);
	const needsChoosing = homeKind(home, realTempRoots()) === "real" && reads.address() === null;
	const spare = needsChoosing ? await pickFreePorts(ADDRESS_ROLES.length) : [];
	return ensureDaemon(by, reads, home, spawnDaemonProcesses, { given, spare });
}

function metaOrThrow(result: EnsureResult): DaemonMeta {
	if (result.kind === "refused") throw new PortsOccupiedError(result.text, []);
	return result.meta;
}

/** `startDaemon` for a caller that wants the record and a thrown error for anything else. */
export async function daemonStart(opts: DaemonStartOptions = {}): Promise<DaemonMeta> {
	const result = await startDaemon("start", opts);
	if (result.kind === "running") {
		throw new Error(
			`Telemetry daemon is already running (Jaeger PID ${result.meta.jaegerPid}, otelcol PID ${result.meta.otelcolPid}, OTLP :${result.meta.otlpPort}, UI :${result.meta.uiPort}). Run 'indusk telemetry stop' first.`,
		);
	}
	return metaOrThrow(result);
}

export async function daemonStop(): Promise<DaemonStopResult> {
	const metaFile = metaFilePath();
	if (!existsSync(metaFile)) return { stopped: false };

	let meta: DaemonMeta;
	try {
		meta = JSON.parse(readFileSync(metaFile, "utf-8")) as DaemonMeta;
	} catch {
		cleanupFiles();
		return { stopped: false };
	}

	// Ownership is the command line, never the port (telemetry-stop-stops-what-it-started):
	// a slow port once made stop signal nothing, delete the record and report success.
	const result = await stopDaemon(meta, induskHome(), {
		alive: realProcessReads.alive,
		command: realProcessReads.command,
		kill: (pid, signal) => process.kill(pid, signal),
		sleep,
	});
	if (result.clearRecord) cleanupFiles();
	return {
		stopped: true,
		signaledJaegerPid: meta.jaegerPid,
		signaledOtelcolPid: meta.otelcolPid,
		stillRunning: result.stillRunning,
	};
}

/**
 * Restart means "same daemon, fresh processes, same address": the real home
 * comes back on its stored address, a temporary home on the ports the stopped
 * daemon held (explicit options win there). `onStopped` runs between the stop
 * and the start (reset truncates the log sink there).
 */
export async function daemonRestart(
	opts: DaemonStartOptions = {},
	hooks: { onStopped?: () => void } = {},
): Promise<DaemonMeta> {
	const home = induskHome();
	const explicit = startOptions(opts, home);
	const previous = restartPorts(daemonState(realDaemonReads(home), home), home);
	await daemonStop();
	hooks.onStopped?.();
	const ports = { ...previous, ...explicit } as Partial<Ports>;
	// Poll the ports until the OS has actually released them. A fixed sleep is
	// unreliable: on machines where TIME_WAIT outlives it, the new daemon would
	// find its own port still held and be refused. 5 s is well above the
	// observed worst-case release time on macOS/Linux loopback.
	await Promise.all(
		Object.values(ports)
			.filter((p): p is number => typeof p === "number" && p > 0)
			.map((p) => waitForPortFree(p, 5_000)),
	);
	const toStart: DaemonStartOptions =
		homeKind(home, realTempRoots()) === "real"
			? {}
			: {
					otlpPort: ports.traces,
					logsPort: ports.logs,
					uiPort: ports.ui,
					mcpPort: ports.mcp,
				};
	return metaOrThrow(await startDaemon("restart", toStart));
}
