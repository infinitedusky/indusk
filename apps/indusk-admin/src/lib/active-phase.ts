import type { PhaseRef } from "@infinitedusky/indusk-mcp/impl-headings";
import type { ImplPhase } from "@infinitedusky/indusk-mcp/impl-parser";
import {
  boundaryMatches,
  type PhaseBoundaryRecord,
} from "@infinitedusky/indusk-mcp/shape/boundary-record";

export interface ActivePhase {
  /** Null when no phase has unchecked items — nothing is being worked. */
  ref: PhaseRef | null;
  /** Set when the choice fell back to document order because no open phase has a boundary record. */
  hint?: "no boundary record";
  /** When the active phase opened, from its boundary record. */
  openedAt?: string;
}

/**
 * Which phase is being worked (admin-ui-phase-progress, ADR D4).
 *
 * The active phase is the one with the MOST RECENT boundary record among
 * phases that still have unchecked items. A phase with every item checked
 * is closed whatever its record says. When no open phase has a record — the
 * pre-boundary-record world, or an executor that never opened one — the
 * first open phase in document order is active, and the hint says so; the
 * UI must render that as a guess, never as a confident marker. Every silent
 * fallback in this area over-reports, and this one is labelled.
 *
 * `records` are the plan's own boundary records (already filtered by plan);
 * a record without `kind` is a build record by the package's rule, applied
 * through `boundaryMatches` rather than restated here.
 */
export function deriveActivePhase(
  phases: ImplPhase[],
  records: PhaseBoundaryRecord[],
): ActivePhase {
  const open = phases.filter((phase) =>
    phase.gates.some((gate) => gate.items.some((item) => !item.checked)),
  );
  if (open.length === 0) return { ref: null };

  let best: { phase: ImplPhase; record: PhaseBoundaryRecord } | null = null;
  for (const phase of open) {
    const ref = { kind: phase.kind, number: phase.number };
    for (const record of records) {
      if (!boundaryMatches(record, ref)) continue;
      if (best === null || record.timestamp > best.record.timestamp) {
        best = { phase, record };
      }
    }
  }
  if (best) {
    return {
      ref: { kind: best.phase.kind, number: best.phase.number },
      openedAt: best.record.timestamp,
    };
  }
  const first = open[0];
  return {
    ref: { kind: first.kind, number: first.number },
    hint: "no boundary record",
  };
}
