import type {
  PromiseEntry,
  Registry,
} from "@infinitedusky/indusk-mcp/promises/registry";
import {
  JaegerUnreachable,
  type MarkedSpansResult,
  readPromiseMarks,
} from "@infinitedusky/indusk-mcp/promises/telemetry";
import { readAdminRefreshMs } from "./project-reader";

/**
 * Observed health on the Promises page and in the sidebar (day-monitor, ADR
 * D9).
 *
 * One read of the local Jaeger per project, through the package's one query
 * (`promises/telemetry`), with a two-second timeout and cached for the
 * project's refresh interval so a page and its sidebar share it. When Jaeger
 * cannot be reached the read says so and remembers when it last succeeded —
 * "health unknown since …" — and no chip is drawn green.
 *
 * Server-side only.
 */

export const PROMISE_HEALTHS = [
  "red",
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
}

export type HealthRead =
  | { ok: true; at: string; marks: MarkedSpansResult }
  | { ok: false; unknownSince: string | null; where: string };

const TIMEOUT_MS = 2_000;
const cache = new Map<string, { expires: number; read: HealthRead }>();
const lastOk = new Map<string, string>();

export async function readHealth(
  projectRoot: string,
  registry: Registry,
): Promise<HealthRead> {
  const hit = cache.get(projectRoot);
  if (hit && hit.expires > Date.now()) return hit.read;
  let read: HealthRead;
  try {
    const marks = await readPromiseMarks(projectRoot, registry, {
      timeoutMs: TIMEOUT_MS,
    });
    const at = new Date().toISOString();
    lastOk.set(projectRoot, at);
    read = { ok: true, at, marks };
  } catch (err) {
    // A health read never takes a page down (day-monitor A26): whatever went
    // wrong, the answer is "unknown since the last good read".
    read = {
      ok: false,
      unknownSince: lastOk.get(projectRoot) ?? null,
      where:
        err instanceof JaegerUnreachable ? err.where : (err as Error).message,
    };
  }
  cache.set(projectRoot, {
    expires: Date.now() + readAdminRefreshMs(projectRoot),
    read,
  });
  return read;
}

/**
 * One promise's chip. Retired is grey and known-violated amber whatever
 * telemetry says; a behaviour promise is red when violated in the window,
 * green when seen upheld, hollow "unverified" when not seen or when Jaeger
 * could not be read. A state or structure promise has no observed health —
 * its health is the suite's — so it gets no chip (null).
 */
export function healthOf(
  p: PromiseEntry,
  read: HealthRead | null,
): HealthRow | null {
  if (p.state === "retired")
    return { health: "grey", violations: null, lastSeen: null };
  const marks = read?.ok ? read.marks.byPromise.get(p.name) : undefined;
  const violations = marks ? marks.violations.length : null;
  const newest = [marks?.violations[0]?.at, marks?.lastUpheld?.at]
    .filter((d): d is Date => d !== undefined)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const lastSeen = newest ? newest.toISOString() : null;
  if (p.kind === "behaviour" && violations !== null && violations > 0) {
    return {
      health: "red",
      violations,
      lastSeen,
      ...(marks?.truncated ? { atLeast: true } : {}),
    };
  }
  if (p.state === "known-violated")
    return { health: "amber", violations, lastSeen };
  if (p.kind !== "behaviour") return null;
  if (marks?.lastUpheld) return { health: "green", violations, lastSeen };
  return { health: "unverified", violations, lastSeen };
}

/** Every promise's row, by name, for the page and the sidebar. */
export function healthRows(
  registry: Registry,
  read: HealthRead | null,
): Record<string, HealthRow> {
  const out: Record<string, HealthRow> = {};
  for (const p of registry.promises) {
    const row = healthOf(p, read);
    if (row) out[p.name] = row;
  }
  return out;
}

/** Plans holding a red promise — the sidebar's roll-up (A23). */
export function redPlans(
  registry: Registry,
  rows: Record<string, HealthRow>,
): Set<string> {
  return new Set(
    registry.promises
      .filter((p) => rows[p.name]?.health === "red")
      .map((p) => p.owner),
  );
}
