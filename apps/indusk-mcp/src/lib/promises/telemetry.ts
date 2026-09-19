import { daemonMetaPath, daemonStatus } from "../telemetry/daemon.js";
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

async function getJson<T>(url: string, timeoutMs: number, queryUrl: string): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
	} catch (err) {
		throw new JaegerUnreachable(queryUrl, (err as Error).message);
	}
	if (!res.ok) throw new JaegerUnreachable(queryUrl, `${url} answered ${res.status}`);
	return (await res.json()) as T;
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
}): Promise<MarkedSpansResult> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const status = await daemonStatus();
	if (!status.running) {
		throw new JaegerUnreachable(daemonMetaPath(), "no telemetry daemon is running");
	}
	const queryUrl = `http://localhost:${status.uiPort}`;
	const services =
		(await getJson<{ data: string[] | null }>(`${queryUrl}/api/services`, timeoutMs, queryUrl))
			.data ?? [];

	const byPromise = new Map<string, PromiseMarks>();
	const start = opts.since.getTime() * 1000;
	const end = Date.now() * 1000;
	for (const promise of opts.promises) {
		const seen = new Map<string, MarkedSpan>();
		for (const service of services) {
			const params = new URLSearchParams({
				service,
				tags: JSON.stringify({ [PROMISE_MARK.promise]: promise }),
				start: String(start),
				end: String(end),
				limit: String(TRACE_LIMIT),
			});
			const traces =
				(
					await getJson<{ data: JaegerTrace[] | null }>(
						`${queryUrl}/api/traces?${params}`,
						timeoutMs,
						queryUrl,
					)
				).data ?? [];
			for (const t of traces) {
				for (const span of t.spans) {
					const marked = toMarked(span, t.processes[span.processID]?.serviceName ?? service);
					if (marked?.promise !== promise) continue;
					if (marked.at < opts.since) continue;
					seen.set(marked.spanId, marked);
				}
			}
		}
		const all = [...seen.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
		byPromise.set(promise, {
			violations: all.filter((s) => s.outcome === "violated"),
			lastUpheld: all.find((s) => s.outcome === "upheld") ?? null,
		});
	}
	return { queryUrl, since: opts.since, byPromise };
}
