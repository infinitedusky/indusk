import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createConnection, createServer } from "node:net";
import { homedir } from "node:os";
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
 * PID-reuse hardening: `verifyIdentity(pid, port)` composes `isAlive(pid)`
 * with `isPortListening(port)` to guard against reporting a recycled PID as
 * "running" (admin-UI Phase 7 lesson — applied here).
 */

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

function pidFilePath(): string {
	return join(induskHome(), "telemetry.pid");
}

function metaFilePath(): string {
	return join(induskHome(), "telemetry.json");
}

function logFilePath(): string {
	return join(induskHome(), "telemetry.log");
}

function ensureHome(): void {
	const h = induskHome();
	if (!existsSync(h)) mkdirSync(h, { recursive: true });
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

export interface DaemonStartOptions {
	otlpPort?: number; // 0 = auto-pick; default 4318
	uiPort?: number; // 0 = auto-pick; default 16686
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

export interface DaemonStopResult {
	stopped: boolean;
	signaledJaegerPid?: number;
	signaledOtelcolPid?: number;
	usedSigkill?: boolean;
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
		s.listen(port, "127.0.0.1");
	});
}

// ---- identity + lifecycle --------------------------------------------------

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function verifyIdentity(pid: number, port: number): Promise<boolean> {
	if (!isAlive(pid)) return false;
	return isPortListening(port);
}

function cleanupFiles(): void {
	for (const p of [pidFilePath(), metaFilePath()]) {
		if (existsSync(p)) rmSync(p, { force: true });
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function waitForPortListening(
	port: number,
	timeoutMs: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await isPortListening(port)) return true;
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
function renderCollectorConfig(ports: {
	otlpHttp: number;
	health: number;
}, logsPath: string): string {
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

// ---- daemonStart / daemonStop / daemonStatus / daemonRestart ---------------

export async function daemonStart(
	opts: DaemonStartOptions = {},
): Promise<DaemonMeta> {
	ensureHome();

	// Fail fast if already running (up-stream uiStart-style guard)
	const existing = await daemonStatus();
	if (existing.running) {
		throw new Error(
			`Telemetry daemon is already running (Jaeger PID ${existing.jaegerPid}, otelcol PID ${existing.otelcolPid}, OTLP :${existing.otlpPort}, UI :${existing.uiPort}). Run 'indusk telemetry stop' first.`,
		);
	}

	const jaegerBin = resolveBinary("jaeger");
	const otelcolBin = resolveBinary("otelcol");

	// Pick 8 ports simultaneously to avoid sequential-pickFreePort collision
	// (see telemetry-ui-reachable.test.ts lesson from Phase 2).
	const [
		otlpHttp,
		otlpGrpc,
		ui,
		uiGrpc,
		jaegerHealth,
		logsOtlp,
		otelcolHealth,
		mcp,
	] = await Promise.all([
		findFreePort(opts.otlpPort ?? 4318),
		findFreePort(0),
		findFreePort(opts.uiPort ?? 16686),
		findFreePort(0),
		findFreePort(0),
		findFreePort(0),
		findFreePort(0),
		findFreePort(16687),
	]);

	// Write configs to INDUSK_HOME/telemetry-{jaeger,collector}.yaml so they
	// survive parent exit and are inspectable post-mortem.
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
		renderCollectorConfig(
			{ otlpHttp: logsOtlp, health: otelcolHealth },
			logsPath,
		),
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

	const meta: DaemonMeta = {
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

	writeFileSync(pidFilePath(), String(meta.jaegerPid));
	writeFileSync(metaFilePath(), JSON.stringify(meta, null, 2));

	return meta;
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
	const otelcolOk = await verifyIdentity(
		meta.otelcolPid,
		meta.otelcolHealthPort,
	);
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

	// Identity gate for stop: if the recorded PIDs aren't ours anymore
	// (PID-reuse), clean up files but don't SIGTERM a stranger.
	const jaegerOk = await verifyIdentity(meta.jaegerPid, meta.uiPort);
	const otelcolOk = await verifyIdentity(
		meta.otelcolPid,
		meta.otelcolHealthPort,
	);
	if (!jaegerOk && !otelcolOk) {
		cleanupFiles();
		return {
			stopped: true,
			signaledJaegerPid: meta.jaegerPid,
			signaledOtelcolPid: meta.otelcolPid,
		};
	}

	// Signal both; poll for exit up to 3s; SIGKILL fallback
	const targets: number[] = [];
	if (jaegerOk) targets.push(meta.jaegerPid);
	if (otelcolOk) targets.push(meta.otelcolPid);
	for (const pid of targets) {
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			// already gone
		}
	}

	for (let i = 0; i < 30; i++) {
		await sleep(100);
		if (targets.every((pid) => !isAlive(pid))) {
			cleanupFiles();
			return {
				stopped: true,
				signaledJaegerPid: meta.jaegerPid,
				signaledOtelcolPid: meta.otelcolPid,
			};
		}
	}

	let usedSigkill = false;
	for (const pid of targets) {
		if (isAlive(pid)) {
			try {
				process.kill(pid, "SIGKILL");
				usedSigkill = true;
			} catch {
				// best-effort
			}
		}
	}
	cleanupFiles();
	return {
		stopped: true,
		signaledJaegerPid: meta.jaegerPid,
		signaledOtelcolPid: meta.otelcolPid,
		usedSigkill,
	};
}

export async function daemonRestart(
	opts: DaemonStartOptions = {},
): Promise<DaemonMeta> {
	await daemonStop();
	// Small pause so OS releases ports before the new spawn
	await sleep(200);
	return daemonStart(opts);
}
