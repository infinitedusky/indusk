import type { Registry } from "@infinitedusky/indusk-mcp/promises/registry";
import {
  healthWindowMs,
  type SourceName,
} from "@infinitedusky/indusk-mcp/promises/sources";
import type {
  MarkedSpan,
  MarkedSpansResult,
  PromiseMarks,
} from "@infinitedusky/indusk-mcp/promises/telemetry";
import {
  type FullSlice,
  readTimeline,
  type TimelineMark,
} from "@infinitedusky/indusk-mcp/promises/timeline";
import {
  buildStrip,
  type Strip,
  type TimelineView,
  WINDOWS,
  type WindowKey,
} from "./timeline-strip";

/**
 * What the admin has read, kept (promise-timeline, ADR D5).
 *
 * A week of one promise's marks is megabytes, because Jaeger returns whole
 * traces (research.md). The page refreshes every few seconds, and its chips
 * and its timeline both need the window. So the admin holds, per project and
 * source, every mark it has read and the range those marks cover, and a
 * request reads only what is not covered: the whole range the first time,
 * then from the newest covered moment (less a minute, for spans indexed late)
 * to now. A refresh with nothing new moves almost nothing (A12).
 *
 * Marks older than the longest window offered are dropped. An admin restart
 * starts empty. A registry that gains a promise starts its source over, since
 * the covered range says nothing about a promise it was never asked for.
 *
 * Server-side only.
 */

export const LONGEST_WINDOW_MS = 30 * 86_400_000;
/** Re-read on every request: spans that Jaeger indexes late. */
const OVERLAP_MS = 60_000;

interface Held {
  coveredFrom: number;
  coveredTo: number;
  promises: string;
  /** Per promise: marks by `${traceId}|${at}|${outcome}`. */
  marks: Map<string, Map<string, TimelineMark>>;
  atLeast: Map<string, FullSlice[]>;
}

const held = new Map<string, Held>();

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
): Promise<WindowRead> {
  const key = `${projectRoot}\0${source}`;
  const now = Date.now();
  const promises = behaviourNames(registry);
  let h = held.get(key);
  if (h && h.promises !== promises) h = undefined;

  const ranges: Array<[number, number]> = [];
  if (!h) ranges.push([fromMs, now]);
  else {
    if (fromMs < h.coveredFrom) ranges.push([fromMs, h.coveredFrom]);
    ranges.push([Math.max(h.coveredFrom, h.coveredTo - OVERLAP_MS), now]);
  }

  const next: Held = h ?? {
    coveredFrom: fromMs,
    coveredTo: fromMs,
    promises,
    marks: new Map(),
    atLeast: new Map(),
  };
  let label = "";
  for (const [from, to] of ranges) {
    const [read] = await readTimeline(projectRoot, registry, {
      from: new Date(from),
      to: new Date(to),
      source,
      timeoutMs,
    });
    if (!read) {
      return {
        ok: false,
        name: source,
        label: source,
        kind: "unreachable",
        where: source,
        reason: `no ${source} source`,
      };
    }
    if (!read.ok) return read;
    label = read.label;
    for (const [promise, t] of read.byPromise) {
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
  }

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

  const out = new Map<string, TimelineMark[]>();
  for (const [promise, marks] of next.marks) {
    out.set(
      promise,
      [...marks.values()]
        .filter((m) => Date.parse(m.at) >= fromMs)
        .sort((a, b) => a.at.localeCompare(b.at)),
    );
  }
  const atLeast = new Map<string, FullSlice[]>();
  for (const [promise, slices] of next.atLeast) {
    atLeast.set(
      promise,
      slices.filter((s) => Date.parse(s.to) >= fromMs),
    );
  }
  return {
    ok: true,
    name: source,
    label: label || source,
    marks: out,
    atLeast,
    oldest,
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

/**
 * The page's timeline for one source and window (ADR D6): read through the
 * store back to the health window, so a break older than the window can
 * still be said, and drawn from the window's own marks.
 */
export async function readTimelineView(
  projectRoot: string,
  registry: Registry,
  opts: {
    window: WindowKey;
    source: SourceName;
    sources: SourceName[];
    timeoutMs: number;
  },
): Promise<TimelineView> {
  const now = Date.now();
  const windowMs = WINDOWS[opts.window].ms;
  const from = now - Math.max(windowMs, healthWindowMs(projectRoot, registry));
  const base = {
    source: opts.source,
    sources: opts.sources,
    window: opts.window,
  };
  const w = await readWindow(
    projectRoot,
    registry,
    opts.source,
    from,
    opts.timeoutMs,
  );
  if (!w.ok) {
    return {
      ...base,
      strips: {},
      reach: null,
      failure: `The ${w.name} Jaeger could not be read (${w.where}): ${w.reason}. No timeline is drawn for it.`,
    };
  }
  const start = now - windowMs;
  const strips: Record<string, Strip | "empty"> = {};
  for (const p of registry.promises) {
    if (p.kind !== "behaviour" || p.state === "retired") continue;
    const marks = w.marks.get(p.name) ?? [];
    if (marks.length === 0) {
      strips[p.name] = "empty";
      continue;
    }
    strips[p.name] = buildStrip({
      promise: p.name,
      marks: marks.filter((m) => Date.parse(m.at) >= start),
      olderMarks: marks.filter((m) => Date.parse(m.at) < start),
      atLeast: w.atLeast.get(p.name) ?? [],
      incidents: registry.incidents,
      window: opts.window,
      now,
    });
  }
  return {
    ...base,
    strips,
    reach:
      opts.source === "local"
        ? w.oldest
          ? `Local history since ${w.oldest.slice(0, 16).replace("T", " ")} — the daemon keeps runs only since it last started.`
          : "No local runs held — the daemon keeps runs only since it last started."
        : null,
    failure: null,
  };
}
