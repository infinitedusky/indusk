import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPass } from "../always-on/pass.js";
import { basicAuthHeaders } from "../promises/telemetry.js";
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
export const SLACK_WEBHOOK_ENV = "INDUSK_SERVER_SLACK_WEBHOOK";
export const PASS_INTERVAL_ENV = "INDUSK_SERVER_PASS_INTERVAL_MS";
export const PASS_WINDOW_ENV = "INDUSK_SERVER_PASS_WINDOW_HOURS";
/** Where the pass reads Jaeger, when it is not the server reading its own. */
export const QUERY_URL_ENV = "INDUSK_SERVER_QUERY_URL";
/** `user:password`, as a reader off the server holds it. */
export const CREDENTIAL_ENV = "INDUSK_SERVER_CREDENTIAL";

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

/** A minute between passes: a violation is worth hearing about promptly, and one query is cheap. */
export const DEFAULT_PASS_INTERVAL_MS = 60_000;

/**
 * How far back each pass looks. A day rather than the retention: the
 * announced record makes a re-read harmless, so the window only has to be
 * wide enough to survive an outage of the pass itself, and scanning
 * twenty-eight days every minute would be work for nothing.
 */
export const DEFAULT_PASS_WINDOW_HOURS = 24;

export interface ServerSettings {
	volume: string;
	otlpPort: number;
	queryPort: number;
	user: string;
	password: string;
	retentionHours: number;
	/** Where violations are announced. Required: a server that cannot say anything is not watching. */
	slackWebhook: string;
	passIntervalMs: number;
	passWindowMs: number;
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

function positive(env: NodeJS.ProcessEnv, name: string, fallback: number, unit: string): number {
	const raw = env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new MissingServerSetting(
			name,
			`not a positive number of ${unit} (got ${JSON.stringify(raw)})`,
		);
	}
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
	return {
		volume: required(env, VOLUME_ENV),
		otlpPort: port(env, OTLP_PORT_ENV),
		queryPort: port(env, QUERY_PORT_ENV),
		user: required(env, USER_ENV),
		password: required(env, PASSWORD_ENV),
		retentionHours: positive(env, RETENTION_ENV, DEFAULT_RETENTION_HOURS, "hours"),
		slackWebhook: required(env, SLACK_WEBHOOK_ENV),
		passIntervalMs: positive(env, PASS_INTERVAL_ENV, DEFAULT_PASS_INTERVAL_MS, "milliseconds"),
		passWindowMs: positive(env, PASS_WINDOW_ENV, DEFAULT_PASS_WINDOW_HOURS, "hours") * 3_600_000,
	};
}

/**
 * What one pass needs, for a pass entered from outside the server —
 * `indusk telemetry announce --once`, which a test (and a person checking a
 * deployment) can run against a server it did not start.
 */
export interface PassSettings {
	volume: string;
	queryUrl: string;
	credential: string;
	slackWebhook: string;
	windowMs: number;
}

export function readPassSettings(env: NodeJS.ProcessEnv = process.env): PassSettings {
	return {
		volume: required(env, VOLUME_ENV),
		queryUrl: required(env, QUERY_URL_ENV).replace(/\/+$/, ""),
		credential: required(env, CREDENTIAL_ENV),
		slackWebhook: required(env, SLACK_WEBHOOK_ENV),
		windowMs: positive(env, PASS_WINDOW_ENV, DEFAULT_PASS_WINDOW_HOURS, "hours") * 3_600_000,
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

	const timer = startPass(settings);

	return new Promise<number>((resolve, reject) => {
		child.once("error", (err) => {
			clearInterval(timer);
			reject(err);
		});
		for (const signal of ["SIGTERM", "SIGINT"] as const) {
			process.on(signal, () => child.kill(signal));
		}
		child.once("close", (code) => {
			clearInterval(timer);
			resolve(code ?? 0);
		});
	});
}

/**
 * Run the pass on the server's own interval, in the server's own process
 * (ADR D2). No scheduler, no second container, no cron entry to get wrong:
 * the thing that is always on is already always on.
 *
 * A pass that throws is logged and the interval continues. The server's job
 * is to keep receiving spans; a Jaeger that is briefly unqueryable — it has
 * just started, it is compacting — must not take the process down with it.
 */
export function startPass(settings: ServerSettings): NodeJS.Timeout {
	const endpoint = {
		queryUrl: `http://127.0.0.1:${settings.queryPort}`,
		headers: basicAuthHeaders(`${settings.user}:${settings.password}`),
	};
	const tick = async (): Promise<void> => {
		try {
			const result = await runPass({
				volume: settings.volume,
				endpoint,
				webhook: settings.slackWebhook,
				windowMs: settings.passWindowMs,
			});
			for (const { span, reason } of result.unannounced) {
				console.error(
					`could not announce ${span.promise} (${span.traceId}): ${reason} — it stays unannounced for the next pass`,
				);
			}
			if (result.announced.length > 0) {
				console.info(`announced ${result.announced.length} violation(s)`);
			}
		} catch (err) {
			console.error(`always-on pass failed: ${(err as Error).message}`);
		}
	};
	const timer = setInterval(() => {
		void tick();
	}, settings.passIntervalMs);
	timer.unref?.();
	return timer;
}
