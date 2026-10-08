import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startPass } from "../always-on/schedule.js";
import { jaegerEndpoint } from "../promises/telemetry.js";
import { resolveBinary } from "./daemon.js";
import { freeLoopbackPort, startQueryDoor } from "./query-door.js";

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
/**
 * Jaeger's gRPC query API. Bound to loopback: nothing outside the container
 * needs it, and it has no basic auth of its own. Left unset, Jaeger bound
 * 0.0.0.0:16685 — unauthenticated, and the same port for every server on a
 * host, so a second one could not start (day-always-on-deploy A8).
 */
export const GRPC_PORT_ENV = "INDUSK_SERVER_GRPC_PORT";
export const DEFAULT_GRPC_PORT = 16685;
export const USER_ENV = "INDUSK_SERVER_USER";
export const PASSWORD_ENV = "INDUSK_SERVER_PASSWORD";
export const RETENTION_ENV = "INDUSK_SERVER_RETENTION_HOURS";
export const SLACK_WEBHOOK_ENV = "INDUSK_SERVER_SLACK_WEBHOOK";
export const PASS_INTERVAL_ENV = "INDUSK_SERVER_PASS_INTERVAL_MS";
export const PASS_WINDOW_ENV = "INDUSK_SERVER_PASS_WINDOW_HOURS";
/** Overrides the heartbeat's staleness, `max(3 × interval, 3 min)` by default — for tests. */
export const WATCHER_STALE_ENV = "INDUSK_SERVER_WATCHER_STALE_MS";
/**
 * The query API as people reach it (e.g. https://<app>.fly.dev:16687), for the
 * trace links the server posts to Slack. Optional: without it the server's
 * messages name the trace and ask for this setting (day-always-on-deploy A11).
 */
export const PUBLIC_QUERY_URL_ENV = "INDUSK_SERVER_PUBLIC_QUERY_URL";
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
	/** Jaeger's gRPC query port, on loopback only. */
	grpcPort: number;
	user: string;
	password: string;
	retentionHours: number;
	/**
	 * Where violations are announced, or null for a server that records and
	 * announces nothing. It was required (day-always-on: "a server that cannot
	 * say anything is not watching"); server-provisioning A7, accepted
	 * 2026-10-08, made it optional — the server still records every violation
	 * and the admin still shows it, and the schedule logs once that
	 * announcements are off.
	 */
	slackWebhook: string | null;
	passIntervalMs: number;
	passWindowMs: number;
	/** A heartbeat older than this means the watcher is blind; absent = `max(3 × interval, 3 min)`. */
	watcherStaleMs?: number;
	/** The query API as people reach it, for trace links; null when not set. */
	publicQueryUrl: string | null;
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

/**
 * A line separator in any of these is refused rather than escaped.
 *
 * The credential goes into `htpasswd.inline` and the volume path into
 * `directories.keys`, both unquoted, so a newline does not corrupt the
 * rendered config — it **extends** it, with whatever the rest of the value
 * says. Escaping would make that safe and also make a typo silently work;
 * refusing says which variable is wrong. A credential with a newline in it is
 * a mistake, not a use case (A22).
 */
const LINE_SEPARATOR = /[\r\n\u2028\u2029]/;

function required(env: NodeJS.ProcessEnv, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new MissingServerSetting(name, "not set");
	if (LINE_SEPARATOR.test(value)) {
		throw new MissingServerSetting(name, "a line separator, which would extend the server config");
	}
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
		grpcPort: env[GRPC_PORT_ENV]?.trim() ? port(env, GRPC_PORT_ENV) : DEFAULT_GRPC_PORT,
		user: required(env, USER_ENV),
		password: required(env, PASSWORD_ENV),
		retentionHours: positive(env, RETENTION_ENV, DEFAULT_RETENTION_HOURS, "hours"),
		slackWebhook: env[SLACK_WEBHOOK_ENV]?.trim() ? required(env, SLACK_WEBHOOK_ENV) : null,
		passIntervalMs: positive(env, PASS_INTERVAL_ENV, DEFAULT_PASS_INTERVAL_MS, "milliseconds"),
		passWindowMs: positive(env, PASS_WINDOW_ENV, DEFAULT_PASS_WINDOW_HOURS, "hours") * 3_600_000,
		publicQueryUrl: env[PUBLIC_QUERY_URL_ENV]?.trim() ? publicQueryUrl(env) : null,
		...(env[WATCHER_STALE_ENV]?.trim()
			? { watcherStaleMs: positive(env, WATCHER_STALE_ENV, 0, "milliseconds") }
			: {}),
	};
}

/**
 * The public query URL, checked: it goes into every Slack message the server
 * posts, so it must be a link Slack can open and must not carry a secret.
 * Trimming slashes alone let `https://user:password@…` post the password to
 * the channel and `<app>.fly.dev:16687` post a dead link (A15). A path is
 * kept, for a Jaeger served under a prefix; a query or fragment is refused,
 * since `/trace/<id>` would land inside it. The refusal never repeats the
 * value — it may be the secret.
 */
function publicQueryUrl(env: NodeJS.ProcessEnv): string {
	const raw = required(env, PUBLIC_QUERY_URL_ENV);
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new MissingServerSetting(
			PUBLIC_QUERY_URL_ENV,
			"not an absolute URL (https://<host>:<port>)",
		);
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new MissingServerSetting(
			PUBLIC_QUERY_URL_ENV,
			`not an http(s) URL (got ${url.protocol})`,
		);
	}
	if (url.username || url.password) {
		throw new MissingServerSetting(
			PUBLIC_QUERY_URL_ENV,
			"carrying a user or password, which every Slack message would show — the link asks a browser to log in instead",
		);
	}
	if (url.search || url.hash) {
		throw new MissingServerSetting(
			PUBLIC_QUERY_URL_ENV,
			"carrying a query or fragment, which a trace link would land inside",
		);
	}
	return jaegerEndpoint(raw).queryUrl;
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
		queryUrl: jaegerEndpoint(required(env, QUERY_URL_ENV)).queryUrl,
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
export function renderServerConfig(
	settings: ServerSettings,
	/** Where Jaeger's query API listens, on loopback, behind the query door (A12). */
	jaegerQueryPort: number = settings.queryPort,
): string {
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
      endpoint: 127.0.0.1:${jaegerQueryPort}
      auth:
        authenticator: basicauth
    grpc:
      endpoint: 127.0.0.1:${settings.grpcPort}

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
	// Jaeger's query API listens on loopback; the public query port is the
	// door, which adds the login challenge Jaeger's basic auth never sends.
	const jaegerQueryPort = await freeLoopbackPort();
	writeFileSync(configPath, renderServerConfig(settings, jaegerQueryPort));

	// The door binds before Jaeger starts. Bound after, a taken public port
	// failed the start with Jaeger already running — an orphan holding the
	// intake and badger's lock, so every restart failed too (A13). Until
	// Jaeger answers, the door answers 502.
	const door = await openDoor(settings.queryPort, jaegerQueryPort);
	const shutDoor = (): void => {
		door.closeAllConnections();
		door.close();
	};

	const binary = resolveBinary("jaeger");
	const child = spawn(binary, [`--config=file:${configPath}`], { stdio: "inherit" });

	const timer = startPass(settings);

	return new Promise<number>((resolve, reject) => {
		child.once("error", (err) => {
			clearInterval(timer);
			shutDoor();
			reject(err);
		});
		for (const signal of ["SIGTERM", "SIGINT"] as const) {
			process.on(signal, () => child.kill(signal));
		}
		child.once("close", (code) => {
			clearInterval(timer);
			// Every connection, not only idle ones: a browser holding a
			// response must not keep a server whose Jaeger is gone alive (A14).
			shutDoor();
			resolve(code ?? 0);
		});
	});
}

/** The query door, or a refusal naming the setting when its port is taken. */
async function openDoor(publicPort: number, jaegerPort: number): ReturnType<typeof startQueryDoor> {
	try {
		return await startQueryDoor({ publicPort, jaegerPort });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
			throw new MissingServerSetting(
				QUERY_PORT_ENV,
				`port ${publicPort}, which another process is already listening on`,
			);
		}
		throw err;
	}
}
