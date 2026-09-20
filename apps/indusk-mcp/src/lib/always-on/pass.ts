import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	DEFAULT_TIMEOUT_MS,
	type JaegerEndpoint,
	type JaegerTrace,
	jaegerGet,
	type MarkedSpan,
	parseMarkedSpan,
} from "../promises/telemetry.js";
import { PROMISE_MARK } from "../promises/vocabulary.js";

/**
 * The always-on pass: what the server does with what it has been sent
 * (day-always-on, ADR D2 and D3).
 *
 * It asks its own Jaeger one question — what has been marked violated since
 * the last pass — and says each answer once, to Slack. It does not know what
 * promises exist: the registry lives in a plan repository and the server has
 * none. A span carrying `indusk.promise` with outcome `violated` is a
 * violation, and that is the whole of the server's knowledge.
 *
 * Announce-once is a record on the volume, written **after** Slack accepts.
 * The failure mode that matters is a violation nobody hears about, so a post
 * that fails leaves the span unannounced and the next pass says it. Saying
 * something twice is a nuisance; saying it never is the thing this is for.
 */

/** Jaeger's own default is 20 traces per query, which would silently truncate a busy window. */
const TRACE_LIMIT = 1500;

export interface AnnouncedRecord {
	/** Span id → when it was announced, ISO. */
	spans: Record<string, string>;
}

export function announcedPath(volume: string): string {
	return join(volume, "announced.json");
}

/**
 * Read the record, treating anything unreadable as empty.
 *
 * Deliberately the opposite of the ledgers that throw: a corrupt record here
 * costs a repeated Slack message, while refusing to run costs every violation
 * from now on. The safe direction is to say it again.
 */
export function readAnnounced(volume: string): AnnouncedRecord {
	const path = announcedPath(volume);
	if (!existsSync(path)) return { spans: {} };
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as AnnouncedRecord;
		if (!parsed || typeof parsed.spans !== "object" || parsed.spans === null) return { spans: {} };
		return { spans: parsed.spans };
	} catch {
		return { spans: {} };
	}
}

/** Write the record back, pruned to `windowMs` so it cannot grow without end. */
export function writeAnnounced(
	volume: string,
	record: AnnouncedRecord,
	opts: { windowMs: number; now: Date },
): void {
	const cutoff = opts.now.getTime() - opts.windowMs;
	const spans: Record<string, string> = {};
	for (const [spanId, at] of Object.entries(record.spans)) {
		const time = Date.parse(at);
		if (Number.isNaN(time) || time >= cutoff) spans[spanId] = at;
	}
	const path = announcedPath(volume);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify({ spans }, null, 1));
}

/**
 * Every span marked violated since `since`, newest first.
 *
 * Asked of every service the server knows, by the outcome tag rather than by
 * promise name — the server has no registry to enumerate.
 */
export async function violationsSince(
	endpoint: JaegerEndpoint,
	since: Date,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<MarkedSpan[]> {
	const services = await jaegerGet<string>(endpoint, "/api/services", timeoutMs);
	const seen = new Map<string, MarkedSpan>();
	for (const service of services) {
		const params = new URLSearchParams({
			service,
			tags: JSON.stringify({ [PROMISE_MARK.outcome]: "violated" }),
			start: String(since.getTime() * 1000),
			end: String(Date.now() * 1000),
			limit: String(TRACE_LIMIT),
		});
		const traces = await jaegerGet<JaegerTrace>(endpoint, `/api/traces?${params}`, timeoutMs);
		for (const trace of traces) {
			for (const span of trace.spans) {
				const process = trace.processes[span.processID];
				const marked = parseMarkedSpan(span, process?.serviceName ?? service, process?.tags);
				if (marked?.outcome !== "violated") continue;
				if (marked.at < since) continue;
				seen.set(marked.spanId, marked);
			}
		}
	}
	return [...seen.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * What Slack is told. One message per violation, and every fact in it comes
 * from the span: an environment nobody set reads as unknown rather than as a
 * guess, because a message that says "production" about staging is worse than
 * one that admits it does not know.
 */
export function slackText(span: MarkedSpan, queryUrl: string): string {
	return [
		`Promise violated: ${span.promise}`,
		span.symptom ?? "_no symptom recorded_",
		`${span.environment ?? "environment unknown"} · ${span.service} · ${span.operation}`,
		`${queryUrl}/trace/${span.traceId}`,
	].join("\n");
}

async function postToSlack(webhook: string, text: string, timeoutMs: number): Promise<void> {
	const res = await fetch(webhook, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text }),
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) throw new Error(`Slack answered ${res.status}`);
}

export interface PassResult {
	/** Violations Slack accepted this pass. */
	announced: MarkedSpan[];
	/** Violations Slack did not accept, with why; they stay for the next pass. */
	unannounced: { span: MarkedSpan; reason: string }[];
	/** Violations skipped because an earlier pass announced them. */
	alreadyAnnounced: number;
}

export interface PassOptions {
	volume: string;
	endpoint: JaegerEndpoint;
	webhook: string;
	/** How far back to look, and how long the announced record keeps a span. */
	windowMs: number;
	timeoutMs?: number;
	now?: Date;
}

/**
 * One pass: look, say what is new, record only what was heard.
 *
 * Each violation is written to the record the moment Slack accepts it, not in
 * a batch at the end — a crash halfway through a noisy window would otherwise
 * repeat everything it had already said.
 */
export async function runPass(opts: PassOptions): Promise<PassResult> {
	const now = opts.now ?? new Date();
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const since = new Date(now.getTime() - opts.windowMs);
	const violations = await violationsSince(opts.endpoint, since, timeoutMs);

	const record = readAnnounced(opts.volume);
	const result: PassResult = { announced: [], unannounced: [], alreadyAnnounced: 0 };

	for (const span of violations) {
		if (record.spans[span.spanId]) {
			result.alreadyAnnounced += 1;
			continue;
		}
		try {
			await postToSlack(opts.webhook, slackText(span, opts.endpoint.queryUrl), timeoutMs);
		} catch (err) {
			result.unannounced.push({ span, reason: (err as Error).message });
			continue;
		}
		record.spans[span.spanId] = now.toISOString();
		writeAnnounced(opts.volume, record, { windowMs: opts.windowMs, now });
		result.announced.push(span);
	}
	return result;
}
