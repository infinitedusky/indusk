import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBinary } from "./daemon.js";

/**
 * The always-on server: the Jaeger InDusk already ships, run as a long-lived
 * process instead of a developer-machine daemon (day-always-on, ADR D1).
 *
 * Two differences from the daemon, and only two: storage is badger on a
 * volume rather than memory, and both doors — the OTLP receiver and the query
 * API — are behind basic auth. Everything else is the same binary and the
 * same config shape, because a second telemetry stack is a second thing to
 * keep true.
 *
 * Every setting comes from the environment. A server is configured by whoever
 * deploys it, and a missing credential must stop the process rather than
 * start an open one, so each required value is named in its own refusal.
 */

/** The volume the server keeps badger's files on. */
export const VOLUME_ENV = "INDUSK_SERVER_VOLUME";
export const OTLP_PORT_ENV = "INDUSK_SERVER_OTLP_PORT";
export const QUERY_PORT_ENV = "INDUSK_SERVER_QUERY_PORT";
export const USER_ENV = "INDUSK_SERVER_USER";
export const PASSWORD_ENV = "INDUSK_SERVER_PASSWORD";
export const RETENTION_ENV = "INDUSK_SERVER_RETENTION_HOURS";

/**
 * How long a span stays readable, in hours.
 *
 * The quiet window is seven days: a closed plan holding a behaviour promise
 * stays in `monitor` until its promises have been quiet that long. A
 * violation must still be readable when someone comes to look at it, and the
 * person who comes to look may be a week late, so the default is four quiet
 * windows — twenty-eight days. Long enough that nothing in the loop's own
 * cadence can outlive it, short enough that a small volume holds it.
 */
export const DEFAULT_RETENTION_HOURS = 24 * 7 * 4;

export interface ServerSettings {
	volume: string;
	otlpPort: number;
	queryPort: number;
	user: string;
	password: string;
	retentionHours: number;
}

export class MissingServerSetting extends Error {
	constructor(
		readonly variable: string,
		detail: string,
	) {
		super(
			`${variable} is ${detail}. The always-on server reads every setting from the environment; see /reference/cli/telemetry-server.`,
		);
		this.name = "MissingServerSetting";
	}
}

function required(env: NodeJS.ProcessEnv, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new MissingServerSetting(name, "not set");
	return value;
}

function port(env: NodeJS.ProcessEnv, name: string): number {
	const raw = required(env, name);
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1 || value > 65535) {
		throw new MissingServerSetting(name, `not a port number (got ${JSON.stringify(raw)})`);
	}
	return value;
}

export function readServerSettings(env: NodeJS.ProcessEnv = process.env): ServerSettings {
	const rawRetention = env[RETENTION_ENV]?.trim();
	let retentionHours = DEFAULT_RETENTION_HOURS;
	if (rawRetention) {
		const value = Number(rawRetention);
		if (!Number.isFinite(value) || value <= 0) {
			throw new MissingServerSetting(
				RETENTION_ENV,
				`not a positive number of hours (got ${JSON.stringify(rawRetention)})`,
			);
		}
		retentionHours = value;
	}
	return {
		volume: required(env, VOLUME_ENV),
		otlpPort: port(env, OTLP_PORT_ENV),
		queryPort: port(env, QUERY_PORT_ENV),
		user: required(env, USER_ENV),
		password: required(env, PASSWORD_ENV),
		retentionHours,
	};
}

/**
 * The server's Jaeger config: badger on the volume, basic auth on both
 * endpoints, self-metrics off (the daemon's port-8888 bind race applies here
 * too, and a server restarts more often than a laptop's daemon).
 *
 * `jaeger_mcp` and `healthcheckv2` are deliberately absent. Each is another
 * unauthenticated door on a public host, nothing in the loop reads either
 * remotely, and a supervisor can check the query port instead.
 */
export function renderServerConfig(settings: ServerSettings): string {
	const storage = join(settings.volume, "badger");
	return `service:
  extensions: [basicauth, jaeger_storage, jaeger_query]
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
  basicauth:
    htpasswd:
      inline: |
        ${settings.user}:${settings.password}
  jaeger_storage:
    backends:
      server_storage:
        badger:
          ephemeral: false
          directories:
            keys: ${join(storage, "keys")}
            values: ${join(storage, "values")}
          ttl:
            spans: ${settings.retentionHours}h
  jaeger_query:
    storage:
      traces: server_storage
    http:
      endpoint: 0.0.0.0:${settings.queryPort}
      auth:
        authenticator: basicauth

receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:${settings.otlpPort}
        auth:
          authenticator: basicauth

processors:
  batch: {}

exporters:
  jaeger_storage_exporter:
    trace_storage: server_storage
`;
}

/**
 * Write the config onto the volume and run Jaeger in the foreground.
 *
 * Foreground on purpose: this is a container's process 1, so the supervisor
 * that started it — Fly, systemd, docker — is the thing that restarts it.
 * Nothing here daemonizes, writes a PID file or registers anything; that is
 * the local daemon's job and it stays the local daemon's job.
 */
export async function serve(env: NodeJS.ProcessEnv = process.env): Promise<number> {
	const settings = readServerSettings(env);
	mkdirSync(settings.volume, { recursive: true });
	const configPath = join(settings.volume, "jaeger-server.yaml");
	writeFileSync(configPath, renderServerConfig(settings));

	const binary = resolveBinary("jaeger");
	const child = spawn(binary, [`--config=file:${configPath}`], { stdio: "inherit" });

	return new Promise<number>((resolve, reject) => {
		child.once("error", reject);
		for (const signal of ["SIGTERM", "SIGINT"] as const) {
			process.on(signal, () => child.kill(signal));
		}
		child.once("close", (code) => resolve(code ?? 0));
	});
}
