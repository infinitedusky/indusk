import { join } from "node:path";
import { readConfig } from "../config.js";
import { secretsFile } from "../server/secrets-file.js";
import { daemonMetaPath, daemonStatus, induskHome } from "../telemetry/status.js";
import { getQuietWindowDays, markProjectId } from "./config.js";
import { probeWatcher, WatcherBlind } from "./probe.js";
import type { PromiseEntry, Registry } from "./registry.js";
import {
	type JaegerEndpoint,
	JaegerUnreachable,
	jaegerEndpoint,
	type MarkedSpansResult,
	markedSpans,
	normalizeJaegerUrl,
} from "./telemetry.js";

export { WatcherBlind } from "./probe.js";
// The admin reads both read failures through this one subpath, so its
// `instanceof` sees the same classes the read path throws.
export { JaegerUnreachable } from "./telemetry.js";

/**
 * Which Jaeger to ask, and reading each (promise-sources).
 *
 * `telemetry.ts` is how to ask one Jaeger; this module is which ones a project
 * has — `local` and, when named, `production` — and reading every one with
 * its own failure. Split out at cleanup: the two change for different
 * reasons, and the split ends the import cycle `telemetry` ⇄ `probe` (the
 * probe needs the query layer; the reads need the probe).
 */

/**
 * Where this project's marks are read from (promise-sources, ADR D1).
 *
 * Sources are derived, not configured: every project has `local`, its
 * telemetry daemon; a project that names `promises.jaeger` also has
 * `production`, the always-on server it names. Absence is the rule rather
 * than a migration — a project that names nothing has one source and behaves
 * exactly as before (A7).
 *
 * The credential lives in the environment variable the config *names*, never
 * in the config: `.indusk/config.json` is committed.
 */
export type SourceName = "local" | "production";

export interface MarkSource {
	name: SourceName;
	endpoint: JaegerEndpoint;
	/** Where it read, named as a person should see it. */
	label: string;
	/** True when the project named a server rather than falling to its daemon. */
	remote: boolean;
	/**
	 * The OTLP/HTTP intake feeding `endpoint`, where the watcher probe is sent
	 * (watcher-heartbeat): the daemon's `otlpPort`, or `promises.jaeger.otlp_url`.
	 * Null when a named server has none — the probe then reads blind.
	 */
	intakeUrl: string | null;
}

/** The config key a named server's intake comes from, as a reader is told to set it. */
export const INTAKE_CONFIG_KEY = "promises.jaeger.otlp_url";

/**
 * A source this project has, resolved — or why it could not be. A source that
 * cannot be resolved (no daemon running, a missing credential) is that
 * source's failure, never the others' (ADR D2).
 */
export type ResolvedSource =
	| { name: SourceName; ok: true; source: MarkSource }
	| { name: SourceName; ok: false; error: JaegerUnreachable };

/** The sources this project has, by name — no I/O. */
export function sourceNames(root: string): SourceName[] {
	return readConfig(root)?.promises?.jaeger ? ["local", "production"] : ["local"];
}

/**
 * The source whose breaks raise the alarm (ADR D5): production when there is
 * one, otherwise local. A local break during development is work in progress.
 */
export function alarmSource(names: readonly SourceName[]): SourceName {
	return names.includes("production") ? "production" : "local";
}

export async function resolveMarkSources(root: string): Promise<ResolvedSource[]> {
	return Promise.all(
		sourceNames(root).map(async (name): Promise<ResolvedSource> => {
			try {
				const source = name === "local" ? await resolveLocal() : resolveProduction(root);
				return { name, ok: true, source };
			} catch (err) {
				if (err instanceof JaegerUnreachable) return { name, ok: false, error: err };
				throw err;
			}
		}),
	);
}

async function resolveLocal(): Promise<MarkSource> {
	const status = await daemonStatus();
	if (!status.running) {
		throw new JaegerUnreachable(daemonMetaPath(), "no telemetry daemon is running");
	}
	const endpoint = jaegerEndpoint(`http://localhost:${status.uiPort}`);
	return {
		name: "local",
		endpoint,
		label: endpoint.queryUrl,
		remote: false,
		intakeUrl: `http://localhost:${status.otlpPort}`,
	};
}

/**
 * `promises.jaeger` as the config file holds it — any JSON at all. Its shape is
 * production's to fail on: a string where the object belongs, or a key left
 * out, is refused naming the key, never thrown as a `TypeError` that takes
 * local's read down with it (promise-sources A8).
 */
function namedServer(root: string): {
	url: string;
	credential_env: string;
	otlp_url?: string;
} {
	const named: unknown = readConfig(root)?.promises?.jaeger;
	const where = `promises.jaeger in ${root}`;
	if (typeof named !== "object" || named === null || Array.isArray(named)) {
		throw new JaegerUnreachable(
			where,
			`promises.jaeger must be an object with url and credential_env, not ${JSON.stringify(named)}`,
		);
	}
	const { url, credential_env, otlp_url } = named as Record<string, unknown>;
	for (const [key, value, optional] of [
		["url", url, false],
		["credential_env", credential_env, false],
		["otlp_url", otlp_url, true],
	] as const) {
		if (optional && value === undefined) continue;
		if (typeof value !== "string") {
			throw new JaegerUnreachable(
				where,
				`promises.jaeger.${key} is ${value === undefined ? "not set" : `not a string (${JSON.stringify(value)})`}`,
			);
		}
	}
	if (!(credential_env as string).trim()) {
		throw new JaegerUnreachable(where, "promises.jaeger.credential_env is empty");
	}
	return {
		url: url as string,
		credential_env: credential_env as string,
		...(otlp_url === undefined ? {} : { otlp_url: otlp_url as string }),
	};
}

function resolveProduction(root: string): MarkSource {
	const named = namedServer(root);
	const queryUrl = jaegerEndpoint(named.url).queryUrl;
	// Refuse against the config key, not against the empty string it holds. An
	// unusable URL used to build an endpoint anyway and fail later as
	// "Jaeger could not be reached ()" — a refusal naming nothing the reader
	// could fix (A27).
	if (!queryUrl || !URL.canParse(queryUrl)) {
		throw new JaegerUnreachable(
			`promises.jaeger.url in ${root}`,
			`promises.jaeger.url is ${queryUrl ? `not a URL (${JSON.stringify(named.url)})` : "empty"}`,
		);
	}
	// The environment first, then the machine's secrets file, where
	// `indusk server connect` stores it: nothing loads that file into the
	// environment, so without this a connected project read production only
	// after a shell that exported the variable (server-provisioning A3).
	const secrets = secretsFile(join(induskHome(), "config.env"));
	const credential =
		process.env[named.credential_env]?.trim() || secrets.get(named.credential_env)?.trim();
	if (!credential) {
		// Named but unreadable: refuse against the URL the reader is asking
		// about, naming the variable they have to set. Falling back to the
		// local daemon here would answer a question about production with a
		// laptop's traces.
		throw new JaegerUnreachable(
			queryUrl,
			`promises.jaeger names ${named.credential_env} for its credential and that variable is not set, in the environment or in ${secrets.path}`,
		);
	}
	const intake = named.otlp_url ? normalizeJaegerUrl(named.otlp_url) : "";
	return {
		name: "production",
		endpoint: jaegerEndpoint(queryUrl, credential),
		label: queryUrl,
		remote: true,
		intakeUrl: intake || null,
	};
}

export interface ReadMarksOptions {
	sinceMs?: number;
	timeoutMs?: number;
	now?: Date;
}

/**
 * One source's marks (ADR D2): the named source, the alarm source by default
 * — production when the project names one — so every caller predating
 * promise-sources reads what it read before. Throws as it always has:
 * `JaegerUnreachable` or `WatcherBlind`.
 */
export async function readPromiseMarks(
	root: string,
	registry: Registry,
	opts: ReadMarksOptions & { source?: SourceName } = {},
): Promise<MarkedSpansResult> {
	const resolved = await resolveMarkSources(root);
	const name = opts.source ?? alarmSource(resolved.map((r) => r.name));
	const one = resolved.find((r) => r.name === name);
	if (!one) {
		throw new Error(`no ${name} source: promises.jaeger is not set in ${root}/.indusk/config.json`);
	}
	if (!one.ok) throw one.error;
	return readSource(root, registry, one.source, opts);
}

/** One source's read: its marks, or why it has none. Never all-or-nothing. */
export type SourceRead =
	| { name: SourceName; label: string; ok: true; marks: MarkedSpansResult }
	| {
			name: SourceName;
			label: string;
			ok: false;
			kind: "unreachable" | "blind";
			/** What was consulted: the daemon's meta file, or the query URL. */
			where: string;
			reason: string;
			error: JaegerUnreachable | WatcherBlind;
	  };

/**
 * Every source's marks, each with its own failure (ADR D2). One dead source
 * never hides another: a laptop with no daemon still reads production, and a
 * production outage still shows the local loop.
 */
export async function readSources(
	root: string,
	registry: Registry,
	opts: ReadMarksOptions = {},
): Promise<SourceRead[]> {
	const resolved = await resolveMarkSources(root);
	return Promise.all(
		resolved.map(async (r): Promise<SourceRead> => {
			if (!r.ok) return failedRead(r.name, r.error.where, r.error);
			try {
				const marks = await readSource(root, registry, r.source, opts);
				return { name: r.name, label: r.source.label, ok: true, marks };
			} catch (err) {
				if (err instanceof JaegerUnreachable || err instanceof WatcherBlind) {
					return failedRead(r.name, r.source.label, err);
				}
				throw err;
			}
		}),
	);
}

function failedRead(
	name: SourceName,
	label: string,
	error: JaegerUnreachable | WatcherBlind,
): SourceRead {
	const blind = error instanceof WatcherBlind;
	return {
		name,
		label,
		ok: false,
		kind: blind ? "blind" : "unreachable",
		where: error.where,
		reason: blind ? error.reason : error.message,
		error,
	};
}

/**
 * The window a health read covers: the quiet window, widened to the longest
 * `expect_every` so a longer expectation can still be judged
 * (watcher-heartbeat, ADR D3). One definition for `readSources` and the
 * admin's store.
 */
export function healthWindowMs(root: string, registry: Registry): number {
	return Math.max(
		getQuietWindowDays(root) * 86_400_000,
		...behaviourOf(registry).map((p) => p.expectEvery?.ms ?? 0),
	);
}

function behaviourOf(registry: Registry): PromiseEntry[] {
	return registry.promises.filter((p) => p.kind === "behaviour" && p.state !== "retired");
}

/**
 * Prove a source's watcher hears before anything it heard is reported: a
 * Jaeger that answers and receives nothing reads exactly like a quiet week
 * (watcher-heartbeat). Throws `WatcherBlind`, or `JaegerUnreachable` when
 * nobody answers. The caller's timeout bounds the probe's wait too: a blind
 * read must fit the admin's 2 s budget, not the probe's own 5 s (A13).
 */
async function probe(root: string, source: MarkSource, timeoutMs?: number): Promise<void> {
	await probeWatcher(
		{ endpoint: source.endpoint, intakeUrl: source.intakeUrl, missingIntake: INTAKE_CONFIG_KEY },
		{ project: markProjectId(root), ...(timeoutMs !== undefined ? { waitMs: timeoutMs } : {}) },
	);
}

/** A source proved to hear, or why it could not be: the probe alone, no marks read. */
export type ProbedSource =
	| { name: SourceName; label: string; ok: true }
	| Extract<SourceRead, { ok: false }>;

/**
 * Every source probed, each failing on its own (promise-timeline): for a
 * reader that takes its marks from elsewhere — the admin's store, which reads
 * only what is new — but must still say *watcher blind* rather than draw
 * health from a deaf watcher.
 */
export async function probeSources(
	root: string,
	opts: { timeoutMs?: number } = {},
): Promise<ProbedSource[]> {
	const resolved = await resolveMarkSources(root);
	return Promise.all(
		resolved.map(async (r): Promise<ProbedSource> => {
			if (!r.ok)
				return failedRead(r.name, r.error.where, r.error) as Extract<SourceRead, { ok: false }>;
			try {
				await probe(root, r.source, opts.timeoutMs);
				return { name: r.name, label: r.source.label, ok: true };
			} catch (err) {
				if (err instanceof JaegerUnreachable || err instanceof WatcherBlind) {
					return failedRead(r.name, r.source.label, err) as Extract<SourceRead, { ok: false }>;
				}
				throw err;
			}
		}),
	);
}

/**
 * One source's marks, as every reader asks for them: the registry's
 * behaviour promises that are not retired, with their aliases, filtered to
 * this project's id, over the health window unless `sinceMs` says otherwise.
 * An explicit `sinceMs` is the window a person asked for and is shown: it is
 * never widened, or `--since 90m` would count a day under "the last 90m" (A9).
 */
async function readSource(
	root: string,
	registry: Registry,
	source: MarkSource,
	opts: ReadMarksOptions,
): Promise<MarkedSpansResult> {
	const now = opts.now ?? new Date();
	const behaviour = behaviourOf(registry);
	const windowMs = opts.sinceMs ?? healthWindowMs(root, registry);
	await probe(root, source, opts.timeoutMs);
	return markedSpans({
		endpoint: source.endpoint,
		promises: behaviour.map((p) => p.name),
		aliases: Object.fromEntries(behaviour.map((p) => [p.name, p.aliases])),
		since: new Date(now.getTime() - windowMs),
		project: markProjectId(root),
		...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
	});
}

/**
 * What to do about a source that could not be read, said from the failure
 * itself — never by re-reading the config, which is the thing that may be
 * malformed (promise-sources A10). `status` and `watch` both print it.
 */
export function sourceAdvice(name: SourceName, error: JaegerUnreachable | WatcherBlind): string {
	if (error instanceof WatcherBlind) {
		// Answered and did not hear: the 2026-10-01 case. Starting the daemon
		// is the wrong advice — something is already answering.
		return `Whatever answers at ${error.where} is not receiving what is sent to ${error.intake}.`;
	}
	// A refusal of the config itself names its key; the fix is in the file.
	if (error.where.startsWith("promises.jaeger")) {
		return "Fix promises.jaeger in .indusk/config.json.";
	}
	return name === "production"
		? `Check ${error.where} is up, and that the variable promises.jaeger.credential_env names holds its credential.`
		: "Start the daemon with `indusk telemetry start`.";
}
