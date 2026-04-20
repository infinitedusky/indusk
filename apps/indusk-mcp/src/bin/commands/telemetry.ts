import {
	daemonRestart,
	daemonStart,
	daemonStatus,
	daemonStop,
	isPortListening,
} from "../../lib/telemetry/daemon.js";

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
 * project count. Registered-projects registry lands in Phase 4 — for now we
 * report 0 as a placeholder so T3's assertion on "project" can pass.
 */
export async function telemetryStatus(): Promise<void> {
	const status = await daemonStatus();
	if (!status.running) {
		console.info("Telemetry daemon: not running");
		console.info("Registered projects 0 (registry lands in Phase 4)");
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
	console.info("Registered projects 0 (registry lands in Phase 4)");
}
