import { violationState } from "@infinitedusky/indusk-mcp/promises/incidents";
import type {
  IncidentEntry,
  PromiseEntry,
  Registry,
} from "@infinitedusky/indusk-mcp/promises/registry";
import {
  alarmSource,
  readSources,
  type SourceName,
  type SourceRead,
  sourceNames,
  WatcherBlind,
} from "@infinitedusky/indusk-mcp/promises/sources";
import {
  type MarkedSpansResult,
  newestMark,
  silencePastExpectation,
} from "@infinitedusky/indusk-mcp/promises/telemetry";
import { readAdminRefreshMs } from "./project-reader";

/**
 * Observed health on the Promises page and in the sidebar (day-monitor, ADR
 * D9).
 *
 * One read per source per project (promise-sources, ADR D7) — `local`, and
 * `production` when the project names one — through the package's reads
 * (`promises/sources`), with a two-second timeout and cached for the
 * project's refresh interval so a page and its sidebar share it. A source
 * that cannot be read says so and remembers when it last succeeded — "health
 * unknown since …" — and no chip is drawn green; the other source is still
 * shown. The sidebar's red comes from the alarm source alone.
 *
 * Server-side only.
 */

export const PROMISE_HEALTHS = [
  "red",
  "fixed",
  "green",
  "unverified",
  "amber",
  "grey",
] as const;
export type PromiseHealth = (typeof PROMISE_HEALTHS)[number];

export interface HealthRow {
  health: PromiseHealth;
  /** Violations in the window; null when telemetry says nothing about this promise. */
  violations: number | null;
  /** The query hit its limit: `violations` is a lower bound (day-monitor A30). */
  atLeast?: boolean;
  /** ISO time of the newest mark, upheld or violated. */
  lastSeen: string | null;
  /**
   * Where the newest violation happened, as its span said (day-always-on D6),
   * or null when it said nothing. One server holds staging and production, so
   * a red row that cannot say which is a red row nobody can act on.
   */
  environment?: string | null;
  /**
   * Set when the promise declares `expect_every` and has been silent longer
   * (watcher-heartbeat, ADR D3) — the shared judgment, never restated here.
   */
  silence?: string;
}

export type HealthRead =
  | { ok: true; at: string; marks: MarkedSpansResult }
  | {
      ok: false;
      unknownSince: string | null;
      where: string;
      /**
       * The watcher answered and did not hear (watcher-heartbeat): a probe sent
       * to `intake` never came back from `where`. Absent when it could not be
       * reached at all.
       */
      blind?: { intake: string };
    };

/** One source's read, named: what the page draws a chip and a banner from. */
export type SourceHealthRead = HealthRead & {
  name: SourceName;
  /** Where it read — its query URL, or what was consulted when it could not. */
  label: string;
};

const TIMEOUT_MS = 2_000;
const cache = new Map<string, { expires: number; reads: SourceHealthRead[] }>();
const lastOk = new Map<string, string>();

export async function readHealth(
  projectRoot: string,
  registry: Registry,
): Promise<SourceHealthRead[]> {
  const hit = cache.get(projectRoot);
  if (hit && hit.expires > Date.now()) return hit.reads;
  let reads: SourceHealthRead[];
  try {
    const sources = await readSources(projectRoot, registry, {
      timeoutMs: TIMEOUT_MS,
    });
    reads = sources.map((r) => fromSource(projectRoot, r));
  } catch (err) {
    // A health read never takes a page down (day-monitor A26): whatever went
    // wrong, every source's answer is "unknown since the last good read".
    reads = sourceNames(projectRoot).map((name) => ({
      name,
      label: (err as Error).message,
      ok: false,
      unknownSince: lastOk.get(`${projectRoot}\0${name}`) ?? null,
      where: (err as Error).message,
    }));
  }
  cache.set(projectRoot, {
    expires: Date.now() + readAdminRefreshMs(projectRoot),
    reads,
  });
  return reads;
}

function fromSource(projectRoot: string, r: SourceRead): SourceHealthRead {
  const key = `${projectRoot}\0${r.name}`;
  if (r.ok) {
    const at = new Date().toISOString();
    lastOk.set(key, at);
    return { name: r.name, label: r.label, ok: true, at, marks: r.marks };
  }
  return {
    name: r.name,
    label: r.label,
    ok: false,
    unknownSince: lastOk.get(key) ?? null,
    where: r.where,
    ...(r.error instanceof WatcherBlind
      ? { blind: { intake: r.error.intake } }
      : {}),
  };
}

/** The read whose red raises the alarm: production when there is one (ADR D5). */
export function alarmRead(
  reads: SourceHealthRead[],
): SourceHealthRead | undefined {
  const name = alarmSource(reads.map((r) => r.name));
  return reads.find((r) => r.name === name);
}

/**
 * One promise's chip. Retired is grey and known-violated amber whatever
 * telemetry says; a behaviour promise is red when violated in the window,
 * green when seen upheld, hollow "unverified" when not seen or when Jaeger
 * could not be read. A state or structure promise has no observed health —
 * its health is the suite's — so it gets no chip (null).
 */
/**
 * How a source's chip judges a promise's violations (promise-timeline, ADR D3).
 *
 * - `incidents` — production's, or the only source's: red while any violation
 *   in the window is unrecorded or its incident open; `fixed` once every one
 *   of them is fixed. A mended promise is not called broken for a week.
 * - `newest` — local's, beside a production source: the newest local run
 *   decides. A local break during development is work in progress; nobody
 *   records an incident for it, so the incident rule would leave it red for
 *   the whole window after the fix.
 */
export type HealthRule = "incidents" | "newest";

/**
 * One promise's chip. Retired is grey and known-violated amber whatever
 * telemetry says, unless a live break makes it red; a behaviour promise is
 * red, `fixed`, green or hollow "unverified" by its source's rule. A state or
 * structure promise has no observed health — its health is the suite's — so
 * it gets no chip (null).
 */
export function healthOf(
  p: PromiseEntry,
  read: HealthRead | null,
  incidents: IncidentEntry[] = [],
  rule: HealthRule = "incidents",
): HealthRow | null {
  if (p.state === "retired")
    return { health: "grey", violations: null, lastSeen: null };
  const marks = read?.ok ? read.marks.byPromise.get(p.name) : undefined;
  const violations = marks ? marks.violations.length : null;
  const newest = newestMark(marks);
  const lastSeen = newest?.toISOString() ?? null;
  const red = (): HealthRow => ({
    health: "red",
    violations,
    lastSeen,
    environment: marks?.violations[0]?.environment ?? null,
    ...(marks?.truncated ? { atLeast: true } : {}),
  });
  if (p.kind === "behaviour" && marks && marks.violations.length > 0) {
    const live =
      rule === "newest"
        ? newest?.getTime() === marks.violations[0].at.getTime()
        : marks.violations.some(
            (v) => violationState(v.traceId, incidents) !== "fixed",
          );
    if (live) return red();
  }
  if (p.state === "known-violated")
    return { health: "amber", violations, lastSeen };
  if (p.kind !== "behaviour") return null;
  const silence = read?.ok ? silencePastExpectation(p, read.marks) : null;
  const quiet = silence ? { silence } : {};
  if (rule === "incidents" && violations !== null && violations > 0)
    return { health: "fixed", violations, lastSeen, ...quiet };
  if (marks?.lastUpheld)
    return { health: "green", violations, lastSeen, ...quiet };
  return { health: "unverified", violations, lastSeen, ...quiet };
}

/** Every promise's row, by name, for the page and the sidebar. */
export function healthRows(
  registry: Registry,
  read: HealthRead | null,
  rule: HealthRule = "incidents",
): Record<string, HealthRow> {
  const out: Record<string, HealthRow> = {};
  for (const p of registry.promises) {
    const row = healthOf(p, read, registry.incidents, rule);
    if (row) out[p.name] = row;
  }
  return out;
}

/**
 * Plans holding a red promise in the alarm source — the sidebar's roll-up
 * (A23). A promise red only locally, beside a production that holds it, is
 * work in progress and does not mark its plan (promise-sources A6).
 */
export function redPlans(
  registry: Registry,
  reads: SourceHealthRead[],
): Set<string> {
  const rows = healthRows(registry, alarmRead(reads) ?? null);
  return new Set(
    registry.promises
      .filter((p) => rows[p.name]?.health === "red")
      .map((p) => p.owner),
  );
}

/**
 * The rule a source's chip is judged by: `newest` for local when the project
 * also has production, `incidents` otherwise (ADR D3).
 */
export function ruleFor(
  read: SourceHealthRead,
  reads: SourceHealthRead[],
): HealthRule {
  return read.name === "local" && reads.some((r) => r.name === "production")
    ? "newest"
    : "incidents";
}
