import { bookkeepingRoots } from "@infinitedusky/indusk-mcp/bookkeeping/roots";
import {
  type HeardRow,
  readHeard,
} from "@infinitedusky/indusk-mcp/promises/heard";
import {
  type ReadRegistryResult,
  type Registry,
  readPromises,
} from "@infinitedusky/indusk-mcp/promises/registry";

/**
 * The admin's one read of the promise registry (day-promises, ADR D6 / D8).
 *
 * Everything goes through the package's `promises/registry` subpath — the
 * admin never parses `.indusk/promises/` itself, the way it never parses
 * plan documents itself. This module adds only the derivations the pages
 * need: "holding N" per plan.
 *
 * Server-side only (filesystem access).
 */

export type ProjectPromises = ReadRegistryResult;

export function readProjectPromises(projectRoot: string): ProjectPromises {
  return readPromises(projectRoot);
}

/**
 * What this machine's recorder heard for the project (incident-recording,
 * ADR D6), from its home, and when it last heard anything — the promise
 * page's counts. Read through the package, never a second reader.
 */
export function readProjectHeard(projectRoot: string): HeardRecord {
  const rows = readHeard(bookkeepingRoots(projectRoot).home);
  const lastHeard = rows.reduce<string | null>(
    (latest, r) => (latest === null || r.at > latest ? r.at : latest),
    null,
  );
  return { rows, lastHeard };
}

export interface HeardRecord {
  rows: HeardRow[];
  /** The newest violation the record holds, ISO; null when it holds none. */
  lastHeard: string | null;
}

/**
 * The registry a read produced, whole or partial. A read with problems still
 * carries every well-formed entry so the page can list them beside the error
 * block; a missing registry carries none.
 */
export function registryOf(read: ProjectPromises): Registry | null {
  if (read.ok) return read.registry;
  if ("partial" in read) return read.partial;
  return null;
}

/**
 * How many promises `plan` holds: the ones it owns that are not retired.
 * `declared` counts too — a plan looks on the hook for what it has not built,
 * which is the honest reading until day-contract resolves it at close.
 */
export function holdingCount(registry: Registry | null, plan: string): number {
  if (!registry) return 0;
  return registry.promises.filter(
    (p) => p.owner === plan && p.state !== "retired",
  ).length;
}

/** `holdingCount` for every owner at once, for the sidebar. Plans holding none are absent. */
export function holdingCounts(read: ProjectPromises): Map<string, number> {
  const registry = registryOf(read);
  const counts = new Map<string, number>();
  if (!registry) return counts;
  for (const p of registry.promises) {
    if (p.state === "retired") continue;
    counts.set(p.owner, (counts.get(p.owner) ?? 0) + 1);
  }
  return counts;
}
