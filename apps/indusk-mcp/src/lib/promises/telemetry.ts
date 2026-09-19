import { daemonMetaPath, daemonStatus } from "../telemetry/status.js";
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

interface JaegerTag {
	key: string;
	value: unknown;
}
interface JaegerSpan {
	traceID: string;
	spanID: string;
	operationName: string;
	startTime: number;
	duration: number;
	processID: string;
	tags?: JaegerTag[];
	logs?: { timestamp: number; fields?: JaegerTag[] }[];
}
interface JaegerTrace {
	traceID: string;
	spans: JaegerSpan[];
	processes: Record<string, { serviceName: string }>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
/** Jaeger's own default is 20 traces per query, which would silently truncate a busy window. */
const TRACE_LIMIT = 1500;

/**
 * One Jaeger query, whose every failure is `JaegerUnreachable` naming the URL:
 * no connection, a timeout (which also aborts a body still being read), a
 * status other than 2xx, a body that is not JSON, or one whose `data` is not
 * the array Jaeger returns. Something else answering on the recorded port is
 * as unreachable as nothing answering (day-monitor A26).
 */
async function getData<T>(url: string, timeoutMs: number, queryUrl: string): Promise<T[]> {
	let body: unknown;
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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

function toMarked(span: JaegerSpan, service: string): MarkedSpan | null {
	const promise = tag(span.tags, PROMISE_MARK.promise);
	const outcome = tag(span.tags, PROMISE_MARK.outcome);
	if (typeof promise !== "string") return null;
	if (outcome !== "upheld" && outcome !== "violated") return null;
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
	const queryUrl = `http://localhost:${status.uiPort}`;
	const services = await getData<string>(`${queryUrl}/api/services`, timeoutMs, queryUrl);

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
				const traces = await getData<JaegerTrace>(
					`${queryUrl}/api/traces?${params}`,
					timeoutMs,
					queryUrl,
				);
				if (traces.length >= TRACE_LIMIT) truncated = true;
				for (const t of traces) {
					for (const span of t.spans) {
						const marked = toMarked(span, t.processes[span.processID]?.serviceName ?? service);
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
