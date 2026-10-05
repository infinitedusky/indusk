import { markProjectId } from "./config.js";
import { WatcherBlind } from "./probe.js";
import type { PromiseEntry, Registry } from "./registry.js";
import { resolveMarkSources, type SourceName } from "./sources.js";
import {
	DEFAULT_TIMEOUT_MS,
	type JaegerEndpoint,
	JaegerUnreachable,
	jaegerGet,
	type MarkedSpan,
	marksBetween,
} from "./telemetry.js";
import type { PromiseOutcome } from "./vocabulary.js";

/**
 * A window of marks, per source (promise-timeline, ADR D4).
 *
 * The timeline needs every run in a window, not the violations and the newest
 * upheld that `markedSpans` keeps — and only what to draw: when, which
 * outcome, which trace. Jaeger returns whole traces (a week of one promise was
 * 10.9 MB, research.md), so nothing here keeps a span; and one query returns
 * at most `queryLimit()` traces, so a query that fills is split at its
 * midpoint and each half read again, down to `MIN_SLICE_MS`. A slice still
 * full at that size is returned in `atLeast`: its runs are a lower bound.
 *
 * Each source is resolved and read on its own, and fails on its own, as
 * `readSources` does. The watcher probe is not repeated: the health read that
 * shares the page has just proved it.
 */

export interface TimelineMark {
	/** When the marked span ended (ISO). */
	at: string;
	outcome: PromiseOutcome;
	traceId: string;
	/** `deployment.environment`, as the span said, or null — a red row names it. */
	environment: string | null;
}

/** A range whose query was still full at the smallest slice: there may be more runs in it. */
export interface FullSlice {
	from: string;
	to: string;
}

export interface PromiseTimeline {
	/** Oldest first, one per marked span. */
	marks: TimelineMark[];
	atLeast: FullSlice[];
}

export type TimelineRead =
	| {
			name: SourceName;
			label: string;
			ok: true;
			from: string;
			to: string;
			byPromise: Map<string, PromiseTimeline>;
	  }
	| {
			name: SourceName;
			label: string;
			ok: false;
			kind: "unreachable" | "blind";
			where: string;
			reason: string;
	  };

/** The smallest slice a full query is split to. */
export const MIN_SLICE_MS = 60_000;

export interface ReadTimelineOptions {
	from: Date;
	to: Date;
	/** Read only this source; every source the project has when absent. */
	source?: SourceName;
	/** Read only these promises; every behaviour promise not retired when absent. */
	promises?: string[];
	timeoutMs?: number;
}

export async function readTimeline(
	root: string,
	registry: Registry,
	opts: ReadTimelineOptions,
): Promise<TimelineRead[]> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const behaviour = registry.promises.filter(
		(p) =>
			p.kind === "behaviour" &&
			p.state !== "retired" &&
			(opts.promises === undefined || opts.promises.includes(p.name)),
	);
	const project = markProjectId(root);
	const resolved = (await resolveMarkSources(root)).filter(
		(r) => opts.source === undefined || r.name === opts.source,
	);
	return Promise.all(
		resolved.map(async (r): Promise<TimelineRead> => {
			if (!r.ok) return failed(r.name, r.error.where, r.error);
			try {
				const byPromise = await readSourceWindow(r.source.endpoint, behaviour, {
					from: opts.from,
					to: opts.to,
					project,
					timeoutMs,
				});
				return {
					name: r.name,
					label: r.source.label,
					ok: true,
					from: opts.from.toISOString(),
					to: opts.to.toISOString(),
					byPromise,
				};
			} catch (err) {
				if (err instanceof JaegerUnreachable || err instanceof WatcherBlind) {
					return failed(r.name, r.source.label, err);
				}
				throw err;
			}
		}),
	);
}

/** One source's window: every behaviour promise's marks across every service and alias. */
async function readSourceWindow(
	endpoint: JaegerEndpoint,
	promises: PromiseEntry[],
	w: { from: Date; to: Date; project: string; timeoutMs: number },
): Promise<Map<string, PromiseTimeline>> {
	const services = await jaegerGet<string>(endpoint, "/api/services", w.timeoutMs);
	const byPromise = new Map<string, PromiseTimeline>();
	for (const promise of promises) {
		const seen = new Map<string, MarkedSpan>();
		const atLeast: FullSlice[] = [];
		for (const service of services) {
			for (const name of [promise.name, ...promise.aliases]) {
				const query = (from: Date, to: Date) =>
					marksBetween(endpoint, {
						service,
						name,
						promise: promise.name,
						from,
						to,
						project: w.project,
						timeoutMs: w.timeoutMs,
					});
				await readSliced(query, w.from, w.to, seen, atLeast);
			}
		}
		byPromise.set(promise.name, {
			marks: [...seen.values()]
				.sort((a, b) => a.at.getTime() - b.at.getTime())
				.map((m) => ({
					at: m.at.toISOString(),
					outcome: m.outcome,
					traceId: m.traceId,
					environment: m.environment,
				})),
			atLeast,
		});
	}
	return byPromise;
}

/** Read [from, to]; when the query fills, read each half instead, down to the smallest slice. */
async function readSliced(
	query: (from: Date, to: Date) => Promise<{ marks: MarkedSpan[]; full: boolean }>,
	from: Date,
	to: Date,
	seen: Map<string, MarkedSpan>,
	atLeast: FullSlice[],
): Promise<void> {
	const read = await query(from, to);
	const span = to.getTime() - from.getTime();
	if (read.full && span > MIN_SLICE_MS) {
		const mid = new Date(from.getTime() + Math.floor(span / 2));
		await readSliced(query, from, mid, seen, atLeast);
		await readSliced(query, mid, to, seen, atLeast);
		return;
	}
	for (const m of read.marks) seen.set(m.spanId, m);
	if (read.full) atLeast.push({ from: from.toISOString(), to: to.toISOString() });
}

function failed(
	name: SourceName,
	label: string,
	error: JaegerUnreachable | WatcherBlind,
): TimelineRead {
	const blind = error instanceof WatcherBlind;
	return {
		name,
		label,
		ok: false,
		kind: blind ? "blind" : "unreachable",
		where: error.where,
		reason: blind ? error.reason : error.message,
	};
}
