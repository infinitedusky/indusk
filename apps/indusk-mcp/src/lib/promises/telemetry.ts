import { daemonMetaPath, daemonStatus } from "../telemetry/status.js";
import { getQuietWindowDays, markProjectId } from "./config.js";
import type { Registry } from "./registry.js";
import { PROMISE_MARK, type PromiseOutcome } from "./vocabulary.js";

/**
 * The one query for promise marks (day-monitor, ADR D4).
 *
 * Reads the local telemetry daemon's Jaeger — the one backend the loop has —
 * through its HTTP query API: list the services, then for each promise ask
 * each service for traces tagged `indusk.promise=<name>` in the window. What
 * comes back is every marked span, per promise, split into violations and
 * upholds.
 *
 * When Jaeger cannot be reached this throws `JaegerUnreachable`, naming where
 * it looked. It never returns an empty result for that case: an empty result
 * reads as "nothing violated", which is the one answer an unreachable
 * backend cannot give.
 */

export class JaegerUnreachable extends Error {
	/** What was consulted: the daemon's meta file, or the query URL. */
	readonly where: string;
	constructor(where: string, reason: string) {
		super(`Jaeger could not be reached (${where}): ${reason}`);
		this.name = "JaegerUnreachable";
		this.where = where;
	}
}

export interface MarkedSpan {
	promise: string;
	outcome: PromiseOutcome;
	traceId: string;
	spanId: string;
	service: string;
	operation: string;
	/** When the span ended. */
	at: Date;
	/** The violated event's symptom, when there is one. */
	symptom: string | null;
	/**
	 * `deployment.environment` as the marking system set it, or null when it
	 * set none (day-always-on D6). Read from the span rather than configured
	 * anywhere: one server holds staging and production, and only the span
	 * knows which one it came from.
	 */
	environment: string | null;
}

/**
 * A Jaeger query API and what it takes to be let in.
 *
 * The local daemon needs no credentials; the always-on server needs basic
 * auth on every request. One shape for both, so a reader never grows a second
 * way to reach Jaeger.
 */
export interface JaegerEndpoint {
	/** e.g. `http://localhost:16686` — no trailing slash. */
	queryUrl: string;
	headers?: Record<string, string>;
}

/** `user:password` as the credential environment variables hold it. */
export function basicAuthHeaders(credential: string): Record<string, string> {
	return { authorization: `Basic ${Buffer.from(credential).toString("base64")}` };
}

export interface PromiseMarks {
	/** Newest first. */
	violations: MarkedSpan[];
	/**
	 * A query for this promise returned as many traces as the limit, so there
	 * may be more: the violation count is a lower bound (day-monitor A30).
	 */
	truncated: boolean;
	/** The newest upheld span in the window, or null. */
	lastUpheld: MarkedSpan | null;
}

export interface MarkedSpansResult {
	/** The query endpoint that answered, e.g. `http://localhost:16686`. */
	queryUrl: string;
	since: Date;
	/** One entry per requested promise, present even when nothing was marked. */
	byPromise: Map<string, PromiseMarks>;
}

export interface JaegerTag {
	key: string;
	value: unknown;
}
export interface JaegerSpan {
	traceID: string;
	spanID: string;
	operationName: string;
	startTime: number;
	duration: number;
	processID: string;
	tags?: JaegerTag[];
	logs?: { timestamp: number; fields?: JaegerTag[] }[];
}
export interface JaegerTrace {
	traceID: string;
	spans: JaegerSpan[];
	processes: Record<string, { serviceName: string }>;
}

/**
 * OpenTelemetry's own resource attribute for the deployment environment. We
 * read the conventional name rather than invent an `indusk.` one: a system
 * that is already instrumented has set this, and asking it to set a second
 * attribute for us is asking it to carry InDusk in its code (ADR D6).
 */
export const ENVIRONMENT_ATTRIBUTE = "deployment.environment";

export const DEFAULT_TIMEOUT_MS = 5_000;
/** Jaeger's own default is 20 traces per query, which would silently truncate a busy window. */
const TRACE_LIMIT = 1500;

/**
 * One Jaeger query, whose every failure is `JaegerUnreachable` naming the URL:
 * no connection, a timeout (which also aborts a body still being read), a
 * status other than 2xx, a body that is not JSON, or one whose `data` is not
 * the array Jaeger returns. Something else answering on the recorded port is
 * as unreachable as nothing answering (day-monitor A26).
 */
export async function jaegerGet<T>(
	endpoint: JaegerEndpoint,
	path: string,
	timeoutMs: number,
): Promise<T[]> {
	const url = `${endpoint.queryUrl}${path}`;
	const queryUrl = endpoint.queryUrl;
	let body: unknown;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(timeoutMs),
			...(endpoint.headers ? { headers: endpoint.headers } : {}),
		});
		if (!res.ok) throw new Error(`${url} answered ${res.status}`);
		body = await res.json();
	} catch (err) {
		throw new JaegerUnreachable(queryUrl, (err as Error).message);
	}
	const data = (body as { data?: unknown } | null)?.data;
	if (data === null || data === undefined) return [];
	if (!Array.isArray(data)) {
		throw new JaegerUnreachable(queryUrl, `${url} did not answer with Jaeger's { data: [...] }`);
	}
	return data as T[];
}

function tag(tags: JaegerTag[] | undefined, key: string): unknown {
	return tags?.find((t) => t.key === key)?.value;
}

export function parseMarkedSpan(span: JaegerSpan, service: string): MarkedSpan | null {
	const promise = tag(span.tags, PROMISE_MARK.promise);
	const outcome = tag(span.tags, PROMISE_MARK.outcome);
	if (typeof promise !== "string") return null;
	if (outcome !== "upheld" && outcome !== "violated") return null;
	const environment = tag(span.tags, ENVIRONMENT_ATTRIBUTE);
	let symptom: string | null = null;
	for (const log of span.logs ?? []) {
		if (tag(log.fields, "event") !== PROMISE_MARK.violatedEvent) continue;
		const s = tag(log.fields, PROMISE_MARK.symptom);
		if (typeof s === "string") symptom = s;
	}
	return {
		promise,
		outcome,
		traceId: span.traceID,
		spanId: span.spanID,
		service,
		operation: span.operationName,
		at: new Date(Math.floor((span.startTime + span.duration) / 1000)),
		symptom,
		environment: typeof environment === "string" ? environment : null,
	};
}

/**
 * Every span marked with one of `promises` since `since`, from the running
 * daemon's Jaeger. `promises` are registry names; aliases are the caller's
 * to expand.
 */
export async function markedSpans(opts: {
	promises: string[];
	since: Date;
	timeoutMs?: number;
	/** This project's id (`getProjectGroupId`); a mark naming another project is dropped. */
	project?: string;
	/**
	 * Earlier names per promise (the registry's `aliases`): marks under them
	 * count as the promise's (day-monitor A27) — an application may still set
	 * the old name after a rename.
	 */
	aliases?: Record<string, string[]>;
}): Promise<MarkedSpansResult> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const status = await daemonStatus();
	if (!status.running) {
		throw new JaegerUnreachable(daemonMetaPath(), "no telemetry daemon is running");
	}
	const endpoint: JaegerEndpoint = { queryUrl: `http://localhost:${status.uiPort}` };
	const queryUrl = endpoint.queryUrl;
	const services = await jaegerGet<string>(endpoint, "/api/services", timeoutMs);

	const byPromise = new Map<string, PromiseMarks>();
	const start = opts.since.getTime() * 1000;
	const end = Date.now() * 1000;
	for (const promise of opts.promises) {
		const seen = new Map<string, MarkedSpan>();
		const names = [promise, ...(opts.aliases?.[promise] ?? [])];
		let truncated = false;
		for (const service of services) {
			for (const name of names) {
				const params = new URLSearchParams({
					service,
					tags: JSON.stringify({ [PROMISE_MARK.promise]: name }),
					start: String(start),
					end: String(end),
					limit: String(TRACE_LIMIT),
				});
				const traces = await jaegerGet<JaegerTrace>(endpoint, `/api/traces?${params}`, timeoutMs);
				if (traces.length >= TRACE_LIMIT) truncated = true;
				for (const t of traces) {
					for (const span of t.spans) {
						const marked = parseMarkedSpan(
							span,
							t.processes[span.processID]?.serviceName ?? service,
						);
						if (!marked || marked.promise !== name) continue;
						marked.promise = promise;
						if (marked.at < opts.since) continue;
						const owner = tag(span.tags, PROMISE_MARK.project);
						if (opts.project !== undefined && typeof owner === "string" && owner !== opts.project) {
							continue;
						}
						seen.set(marked.spanId, marked);
					}
				}
			}
		}
		const all = [...seen.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
		byPromise.set(promise, {
			truncated,
			violations: all.filter((s) => s.outcome === "violated"),
			lastUpheld: all.find((s) => s.outcome === "upheld") ?? null,
		});
	}
	return { queryUrl, since: opts.since, byPromise };
}

/**
 * This project's marks, as every reader asks for them: the registry's
 * behaviour promises that are not retired, with their aliases, filtered to
 * this project's id, over the quiet window unless `sinceMs` says otherwise.
 * The one call `status`, `watch` and the admin make — each once assembled the
 * four by hand, and A27/A28 had to change all three.
 */
export function readPromiseMarks(
	root: string,
	registry: Registry,
	opts: { sinceMs?: number; timeoutMs?: number; now?: Date } = {},
): Promise<MarkedSpansResult> {
	const now = opts.now ?? new Date();
	const behaviour = registry.promises.filter(
		(p) => p.kind === "behaviour" && p.state !== "retired",
	);
	return markedSpans({
		promises: behaviour.map((p) => p.name),
		aliases: Object.fromEntries(behaviour.map((p) => [p.name, p.aliases])),
		since: new Date(now.getTime() - (opts.sinceMs ?? getQuietWindowDays(root) * 86_400_000)),
		project: markProjectId(root),
		...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
	});
}
