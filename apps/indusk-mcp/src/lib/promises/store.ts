import type { Registry } from "./registry.js";
import { healthWindowMs, resolveMarkSources, type SourceName } from "./sources.js";
import type { MarkedSpan, MarkedSpansResult, PromiseMarks } from "./telemetry.js";
import { type FullSlice, readTimeline, type TimelineMark } from "./timeline.js";

/**
 * What has been read, kept (promise-timeline, ADR D5; moved from the admin
 * into the package by vscode-extension, so every window reads through one
 * store). Originally: what the admin has read, kept.
 *
 * A week of one promise's marks is megabytes, because Jaeger returns whole
 * traces (research.md). The page refreshes every few seconds, and its chips
 * and its timeline both need the window. So the admin holds, per project and
 * source, every mark it has read and the range those marks cover, and a
 * request reads only what is not covered: the whole range the first time,
 * then the last ten minutes to now. A refresh with nothing new moves almost
 * nothing (A12).
 *
 * A run reaches Jaeger when its exporter sends it, not when it ended: a
 * buffered exporter, or an application that reconnects, delivers a run
 * minutes after its moment. So every refresh re-reads a late tail of
 * `LATE_MS`, and every `FULL_REREAD_MS` the whole window is read again, its
 * held marks kept, for a run later still (A17).
 *
 * Held marks are keyed by the server they came from, not only the source's
 * name: a project repointed at another server starts over rather than drawing
 * the old server's runs as the new one's (A16).
 *
 * Marks older than the longest window offered are dropped. An admin restart
 * starts empty. A registry that gains a promise starts its source over, since
 * the covered range says nothing about a promise it was never asked for.
 *
 * Server-side only.
 */

export const LONGEST_WINDOW_MS = 30 * 86_400_000;
/** Re-read on every request: runs that reach Jaeger after they ended. */
const LATE_MS = 10 * 60_000;
/** How often the whole window is read again, for runs later than the tail. */
const FULL_REREAD_MS = 10 * 60_000;
/** A window is read in slices no longer than this, newest first. */
const SLICE_MS = 12 * 3_600_000;
/** A refresh starts no new slice once it has spent this many query timeouts. */
const READ_BUDGET_TIMEOUTS = 2;

interface Held {
	coveredFrom: number;
	coveredTo: number;
	/** When coverage last reached the oldest moment asked for; null while a read is under way. */
	fullAt: number | null;
	promises: string;
	/** For each promise, its marks keyed by `${traceId}|${at}|${outcome}`. */
	marks: Map<string, Map<string, TimelineMark>>;
	atLeast: Map<string, FullSlice[]>;
}

const held = new Map<string, Held>();

/**
 * What the store reads with: the clock, and how it resolves and reads a
 * source. The real ones by default; a test passes its own, so a rule about
 * late runs or a slow window is checked in milliseconds, without a Jaeger or a
 * wait (test-kinds, ADR D2 — lesson:
 * code-that-decides-takes-its-clock-and-its-reads).
 */
export interface StoreDeps {
	now?: () => number;
	resolve?: typeof resolveMarkSources;
	read?: typeof readTimeline;
}

export type WindowRead =
	| {
			ok: true;
			name: SourceName;
			label: string;
			/** Per promise, oldest first, at or after `from`. */
			marks: Map<string, TimelineMark[]>;
			atLeast: Map<string, FullSlice[]>;
			/** The oldest mark held for this source, across promises, or null. */
			oldest: string | null;
			/** How far back this source has been read; later than `from` while a read is under way. */
			coveredFrom: string;
	  }
	| {
			ok: false;
			name: SourceName;
			label: string;
			kind: "unreachable" | "blind";
			where: string;
			reason: string;
	  };

function markKey(m: TimelineMark): string {
	return `${m.traceId}|${m.at}|${m.outcome}`;
}

function behaviourNames(registry: Registry): string {
	return registry.promises
		.filter((p) => p.kind === "behaviour" && p.state !== "retired")
		.map((p) => p.name)
		.sort()
		.join(",");
}

/**
 * The marks of `source` from `fromMs` to now, reading only what the store
 * does not already cover.
 */
export async function readWindow(
	projectRoot: string,
	registry: Registry,
	source: SourceName,
	fromMs: number,
	timeoutMs: number,
	deps: StoreDeps = {},
): Promise<WindowRead> {
	const clock = deps.now ?? Date.now;
	const read = deps.read ?? readTimeline;
	const resolved = (await (deps.resolve ?? resolveMarkSources)(projectRoot)).find(
		(r) => r.name === source,
	);
	if (!resolved?.ok) {
		return {
			ok: false,
			name: source,
			label: source,
			kind: "unreachable",
			where: resolved ? resolved.error.where : source,
			reason: resolved ? resolved.error.message : `no ${source} source`,
		};
	}
	const prefix = `${projectRoot}\0${source}\0`;
	const key = `${prefix}${resolved.source.label}`;
	for (const k of held.keys()) if (k.startsWith(prefix) && k !== key) held.delete(k);
	const now = clock();
	const promises = behaviourNames(registry);
	let h = held.get(key);
	if (h && h.promises !== promises) h = undefined;
	// Time for the whole window again: keep the marks, forget the coverage.
	if (h && h.fullAt !== null && now - h.fullAt >= FULL_REREAD_MS) {
		h = { ...h, coveredFrom: now, coveredTo: now, fullAt: null };
	}

	// Newest first, in slices: the late tail, then back from the oldest covered
	// moment. Each slice is kept as it lands and coverage grows by it, so a
	// refresh that runs out of budget leaves the next one less to read, and a
	// window too slow to read at once is drawn over a few refreshes (A19).
	const slices: Array<[number, number]> = [];
	let back = now;
	const tailed = Boolean(h && h.coveredFrom < h.coveredTo);
	if (h && h.coveredFrom < h.coveredTo) {
		slices.push([Math.max(h.coveredFrom, h.coveredTo - LATE_MS), now]);
		back = h.coveredFrom;
	}
	for (let to = back; to > fromMs; to -= SLICE_MS) {
		slices.push([Math.max(fromMs, to - SLICE_MS), to]);
	}

	const next: Held = h ?? {
		coveredFrom: now,
		coveredTo: now,
		fullAt: null,
		promises,
		marks: new Map(),
		atLeast: new Map(),
	};
	const label = resolved.source.label;
	const started = clock();
	let landed = 0;
	let failure: Extract<WindowRead, { ok: false }> | null = null;
	// The tail is always read, and then at least one older slice: a tail that
	// spends the whole budget on its own must not stop the window from ever
	// being read further (test-kinds, found by the store's unit test A8).
	let older = 0;
	for (const [i, [from, to]] of slices.entries()) {
		const isTail = i === 0 && tailed;
		if (!isTail && older > 0 && clock() - started >= timeoutMs * READ_BUDGET_TIMEOUTS) {
			break;
		}
		const [slice] = await read(projectRoot, registry, {
			from: new Date(from),
			to: new Date(to),
			source,
			timeoutMs,
		});
		if (!slice?.ok) {
			failure = slice ?? {
				ok: false,
				name: source,
				label,
				kind: "unreachable",
				where: source,
				reason: `no ${source} source`,
			};
			break;
		}
		for (const [promise, t] of slice.byPromise) {
			const marks = next.marks.get(promise) ?? new Map<string, TimelineMark>();
			for (const m of t.marks) marks.set(markKey(m), m);
			next.marks.set(promise, marks);
			const slices = (next.atLeast.get(promise) ?? []).filter(
				(s) => Date.parse(s.to) <= from || Date.parse(s.from) >= to,
			);
			next.atLeast.set(promise, [...slices, ...t.atLeast]);
		}
		next.coveredFrom = Math.min(next.coveredFrom, from);
		next.coveredTo = Math.max(next.coveredTo, to);
		landed++;
		if (!isTail) older++;
	}

	if (next.coveredFrom <= fromMs && next.fullAt === null) next.fullAt = now;

	// Keep no more than the longest window offered.
	const floor = now - LONGEST_WINDOW_MS;
	next.coveredFrom = Math.max(next.coveredFrom, floor);
	let oldest: string | null = null;
	for (const marks of next.marks.values()) {
		for (const [k, m] of marks) {
			if (Date.parse(m.at) < floor) marks.delete(k);
			else if (oldest === null || m.at < oldest) oldest = m.at;
		}
	}
	held.set(key, next);
	// Nothing read this time: the source's failure is the answer. Something read
	// and then a failure: what landed is kept and drawn, the rest is unread.
	if (failure && landed === 0) return failure;

	const out = new Map<string, TimelineMark[]>();
	for (const [promise, marks] of next.marks) {
		out.set(
			promise,
			[...marks.values()]
				.filter((m) => Date.parse(m.at) >= fromMs)
				.sort((a, b) => a.at.localeCompare(b.at)),
		);
	}
	// A range not yet read may hold runs: every count over it is "at least".
	const unread: FullSlice[] =
		next.coveredFrom > fromMs
			? [
					{
						from: new Date(fromMs).toISOString(),
						to: new Date(next.coveredFrom).toISOString(),
					},
				]
			: [];
	const atLeast = new Map<string, FullSlice[]>();
	for (const promise of promises.split(",").filter(Boolean)) {
		atLeast.set(promise, [
			...unread,
			...(next.atLeast.get(promise) ?? []).filter((s) => Date.parse(s.to) >= fromMs),
		]);
	}
	return {
		ok: true,
		name: source,
		label,
		marks: out,
		atLeast,
		oldest,
		coveredFrom: new Date(next.coveredFrom).toISOString(),
	};
}

/**
 * Held marks in the shape the chips read (`MarkedSpansResult`): per promise,
 * violations newest first and the newest upheld. Only what the chips use is
 * carried; a compact mark has no span id, service or symptom.
 */
export function asMarkedSpans(
	w: Extract<WindowRead, { ok: true }>,
	since: Date,
): MarkedSpansResult {
	const byPromise = new Map<string, PromiseMarks>();
	for (const [promise, marks] of w.marks) {
		const spans: MarkedSpan[] = marks
			.map((m) => ({
				promise,
				outcome: m.outcome,
				traceId: m.traceId,
				spanId: m.traceId,
				service: "",
				operation: "",
				at: new Date(m.at),
				symptom: null,
				environment: m.environment,
			}))
			.sort((a, b) => b.at.getTime() - a.at.getTime());
		byPromise.set(promise, {
			violations: spans.filter((s) => s.outcome === "violated"),
			lastUpheld: spans.find((s) => s.outcome === "upheld") ?? null,
			truncated: (w.atLeast.get(promise) ?? []).length > 0,
		});
	}
	return { queryUrl: w.label, since, byPromise };
}
