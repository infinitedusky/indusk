import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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

/**
 * The most violations one pass will announce.
 *
 * A bad deploy is not one violation, it is hundreds, and one message each is a
 * tight loop of POSTs that Slack answers 429 — after which every one of them
 * counts as unannounced and the next pass tries them all again, a flood that
 * never converges (A26). The rest are **held**, not dropped: they stay out of
 * the record, so the next pass announces them.
 */
export const MAX_ANNOUNCEMENTS_PER_PASS = 10;

/**
 * One pass at a time per volume.
 *
 * `setInterval` starts the next tick whether or not the last one finished, and
 * two passes both read the record before either writes it — so a pass slower
 * than its interval announces everything twice, which is precisely the claim
 * this module exists to keep (A23). An in-process guard is enough because the
 * server runs the pass in its own process; a second *process* against one
 * volume is not a supported deployment (badger is single-writer anyway).
 */
const running = new Set<string>();

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
export type AnnouncedRead = { ok: true; record: AnnouncedRecord } | { ok: false; problem: string };

/**
 * Read the record, distinguishing **absent** from **unreadable**.
 *
 * Absent is the ordinary first run and means nothing has been announced.
 * Unreadable — truncated by a machine replaced mid-write, a directory where
 * the file belongs, permissions — is not the same fact, and treating it as
 * empty re-announces the whole window (A24) and keeps doing so every interval
 * forever (A25). The caller stops instead, and says which.
 */
export function readAnnounced(volume: string): AnnouncedRead {
	const path = announcedPath(volume);
	if (!existsSync(path)) return { ok: true, record: { spans: {} } };
	let raw: string;
	try {
		raw = readFileSync(path, "utf-8");
	} catch (err) {
		return { ok: false, problem: `${path} could not be read: ${(err as Error).message}` };
	}
	try {
		const parsed = JSON.parse(raw) as AnnouncedRecord;
		if (!parsed || typeof parsed.spans !== "object" || parsed.spans === null) {
			return { ok: false, problem: `${path} is not an announced record` };
		}
		return { ok: true, record: { spans: parsed.spans } };
	} catch (err) {
		return { ok: false, problem: `${path} is not valid JSON: ${(err as Error).message}` };
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
	// Write and rename: `writeFileSync` to the live path leaves a truncated
	// file when the machine is replaced mid-write, and a truncated file is one
	// a reader has to refuse (A24). Rename is atomic on the same filesystem.
	const temp = `${path}.${process.pid}.tmp`;
	writeFileSync(temp, JSON.stringify({ spans }, null, 1));
	renameSync(temp, path);
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
	/** Over the cap for this pass, deliberately left for the next one (A26). */
	held: MarkedSpan[];
	/** Set when the announced record could not be read or written — nothing was announced (A24, A25). */
	recordProblem: string | null;
	/** Set when another pass was already running against this volume (A23). */
	skipped?: true;
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
/**
 * Prove the record can be written *before* anything is announced, and say why
 * if it cannot.
 *
 * Announcing first and failing to record is the same violation again every
 * interval, forever — the flood the record exists to prevent (A25). The check
 * is a real write of the current record rather than a permissions probe,
 * because the only question that matters is whether this write will work.
 */
function proveRecordWritable(
	volume: string,
	record: AnnouncedRecord,
	opts: { windowMs: number; now: Date },
): string | null {
	try {
		writeAnnounced(volume, record, opts);
		return null;
	} catch (err) {
		return `${announcedPath(volume)} could not be written: ${(err as Error).message}`;
	}
}

export async function runPass(opts: PassOptions): Promise<PassResult> {
	const empty: PassResult = {
		announced: [],
		unannounced: [],
		alreadyAnnounced: 0,
		held: [],
		recordProblem: null,
	};

	// A23: one pass at a time per volume, or both read the record before
	// either writes it and every violation is announced twice.
	if (running.has(opts.volume)) return { ...empty, skipped: true };
	running.add(opts.volume);
	try {
		const now = opts.now ?? new Date();
		const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

		const read = readAnnounced(opts.volume);
		if (!read.ok) return { ...empty, recordProblem: read.problem };
		const record = read.record;

		const unwritable = proveRecordWritable(opts.volume, record, {
			windowMs: opts.windowMs,
			now,
		});
		if (unwritable) return { ...empty, recordProblem: unwritable };

		const since = new Date(now.getTime() - opts.windowMs);
		const violations = await violationsSince(opts.endpoint, since, timeoutMs);

		const result: PassResult = {
			announced: [],
			unannounced: [],
			alreadyAnnounced: 0,
			held: [],
			recordProblem: null,
		};

		for (const span of violations) {
			if (record.spans[span.spanId]) {
				result.alreadyAnnounced += 1;
				continue;
			}
			// A26: hold the rest rather than announce them. They stay out of the
			// record, so the next pass says them.
			if (result.announced.length >= MAX_ANNOUNCEMENTS_PER_PASS) {
				result.held.push(span);
				continue;
			}
			try {
				await postToSlack(opts.webhook, slackText(span, opts.endpoint.queryUrl), timeoutMs);
			} catch (err) {
				result.unannounced.push({ span, reason: (err as Error).message });
				continue;
			}
			record.spans[span.spanId] = now.toISOString();
			try {
				writeAnnounced(opts.volume, record, { windowMs: opts.windowMs, now });
			} catch (err) {
				// It was said and cannot be recorded. Stop: every remaining
				// violation would be re-said next pass anyway.
				result.recordProblem = `${announcedPath(opts.volume)} could not be written after announcing ${span.promise}: ${(err as Error).message}`;
				result.held.push(...violations.slice(violations.indexOf(span) + 1));
				break;
			}
			result.announced.push(span);
		}
		return result;
	} finally {
		running.delete(opts.volume);
	}
}
