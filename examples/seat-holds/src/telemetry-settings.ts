/**
 * Telemetry settings — where this app's spans and logs go, the service it names, and
 * what every span says about where it ran.
 *
 * Written by `indusk init` and refreshed by `indusk update` while you leave it as it is;
 * once you change it, a newer version is written beside it as `telemetry-settings.ts.indusk-new`.
 * A formatter's layout (line breaks, spacing, quotes, semicolons) is not a change.
 * The line marked RENDERED holds this project's values: the service name, the InDusk
 * project id, and the local daemon's traces and logs addresses (`indusk telemetry address`).
 *
 * Every value can be set from the environment, and a set value wins:
 *   OTEL_EXPORTER_OTLP_ENDPOINT         — one collector for traces and logs (`/v1/traces`, `/v1/logs` added)
 *   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT  — the traces URL, as given
 *   OTEL_EXPORTER_OTLP_LOGS_ENDPOINT    — the logs URL, as given
 *   OTEL_SERVICE_NAME                   — the service name
 *   OTEL_RESOURCE_ATTRIBUTES            — `deployment.environment=production` sets the environment
 *
 * A run under a test runner (Vitest, Jest, a Vite test build, NODE_ENV=test) is marked
 * `indusk.run=test` on the resource, so what reads these spans can tell a test's from a user's.
 *
 * No imports: the instrumentation, the logger and the browser file all read it.
 */

export interface Rendered {
	service: string;
	project: string;
	traces: string;
	logs: string;
}

/** Replaced whole by the scaffold; one line, so a render is one substitution. */
export const RENDERED: Rendered = {
	service: "seat-holds",
	project: "seat_holds",
	traces: "http://localhost:24318",
	logs: "http://localhost:24319",
};

export interface TelemetrySettings {
	serviceName: string;
	tracesUrl: string;
	logsUrl: string;
	/** Whether this run is a test run; its spans are marked so readers can tell them apart. */
	testRun: boolean;
	resource: Record<string, string>;
}

type Env = Record<string, string | undefined>;

/** The signal's own endpoint as given, else the general one or the rendered address with the signal's path. */
function endpoint(env: Env, own: string, rendered: string, path: string): string {
	const given = env[own];
	if (given) return given;
	const base = env.OTEL_EXPORTER_OTLP_ENDPOINT || rendered;
	return `${base.replace(/\/+$/, "")}${path}`;
}

/** A percent-encoded value decoded; one that is not valid percent-encoding is kept as written. */
function decoded(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** One key of `OTEL_RESOURCE_ATTRIBUTES` (`k=v,k2=v2`), or undefined when it is not set there. */
function resourceAttribute(env: Env, key: string): string | undefined {
	for (const pair of (env.OTEL_RESOURCE_ATTRIBUTES ?? "").split(",")) {
		const eq = pair.indexOf("=");
		if (eq > 0 && pair.slice(0, eq).trim() === key) return decoded(pair.slice(eq + 1).trim());
	}
	return undefined;
}

/** The settings for this run, from its environment and the rendered values. */
export function telemetrySettings(env: Env, r: Rendered = RENDERED): TelemetrySettings {
	const serviceName = env.OTEL_SERVICE_NAME || r.service;
	const testRun = Boolean(
		env.VITEST || env.JEST_WORKER_ID || env.MODE === "test" || env.NODE_ENV === "test",
	);
	return {
		serviceName,
		tracesUrl: endpoint(env, "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", r.traces, "/v1/traces"),
		logsUrl: endpoint(env, "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT", r.logs, "/v1/logs"),
		testRun,
		resource: {
			"service.name": serviceName,
			"indusk.project": r.project,
			"deployment.environment": resourceAttribute(env, "deployment.environment") ?? "development",
			...(testRun ? { "indusk.run": "test" } : {}),
		},
	};
}
