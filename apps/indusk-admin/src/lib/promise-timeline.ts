import type { Registry } from "@infinitedusky/indusk-mcp/promises/registry";
import {
  healthWindowMs,
  type SourceName,
} from "@infinitedusky/indusk-mcp/promises/sources";
import {
  readWindow,
  type StoreDeps,
} from "@infinitedusky/indusk-mcp/promises/store";
import {
  buildStrip,
  type Strip,
  type TimelineView,
  WINDOWS,
  type WindowKey,
} from "./timeline-strip";

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
  deps: StoreDeps = {},
): Promise<TimelineView> {
  const now = (deps.now ?? Date.now)();
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
    deps,
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
  const stamp = (iso: string) => iso.slice(0, 16).replace("T", " ");
  let reach: string | null = null;
  if (Date.parse(w.coveredFrom) > start) {
    reach = `Read back to ${stamp(w.coveredFrom)} so far — older runs are still being read, and each refresh reads further.`;
  } else if (opts.source === "local") {
    reach = w.oldest
      ? `Local history since ${stamp(w.oldest)} — the daemon keeps runs only since it last started.`
      : "No local runs held — the daemon keeps runs only since it last started.";
  }
  return { ...base, strips, reach, failure: null };
}
