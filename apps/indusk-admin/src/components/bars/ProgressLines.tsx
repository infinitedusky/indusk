import { parseImplString } from "@infinitedusky/indusk-mcp/impl-parser";
import { phaseTitle } from "@/components/bars/labels";
import { PhaseBar } from "@/components/bars/PhaseBar";
import { PhasesBar } from "@/components/bars/PhasesBar";
import { type ActivePhase, deriveActivePhase } from "@/lib/active-phase";
import { extractPhases, type Phase } from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/**
 * The progress lines under the plan bar (admin-ui-phase-progress cleanup):
 * the phase line and the active phase's stage bar, plus the one derivation
 * that feeds them and the plan bar's label. Moved out of `PlanDetail`, which
 * composes ten sections and had this as its only logic.
 */

/**
 * The active phase, by ADR D4: most recent boundary record among open phases,
 * else the first open phase with a hint. Null when the record file is
 * malformed — the page shows the error instead of guessing.
 */
export function activePhaseOf(plan: Plan): ActivePhase | null {
  if (!plan.impl || plan.boundaryError) return null;
  return deriveActivePhase(
    parseImplString(plan.impl.content).phases,
    plan.boundaries ?? [],
  );
}

/** The `Phase` view of the active phase, when there is one, among `phases`. */
function findActive(
  active: ActivePhase | null,
  phases: Phase[],
): Phase | undefined {
  if (!active?.ref) return undefined;
  return phases.find(
    (p) => p.kind === active.ref?.kind && p.number === active.ref?.number,
  );
}

/**
 * "Phase 4" — the plan bar's label while executing. Each line names the
 * level below it: this one the phase, the phase line the stage, the stage bar
 * the item being worked (Sandy, U1 review).
 */
export function activePhaseLabel(plan: Plan): string | null {
  if (!plan.impl) return null;
  const phase = findActive(
    activePhaseOf(plan),
    extractPhases(plan.impl.content, plan.impl.trajectory),
  );
  return phase ? phaseTitle(phase) : null;
}

/**
 * The phase line and the active phase's stage bar — what is happening now,
 * readable before any section is opened. The hint marks a guess (no boundary
 * record) as a guess, never as a confident marker.
 */
export function ProgressLines({ plan }: { plan: Plan }) {
  if (!plan.impl) return null;
  const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
  if (phases.length === 0) return null;
  const active = activePhaseOf(plan);
  const activePhase = findActive(active, phases);
  const activeKey = activePhase
    ? `${activePhase.kind}-${activePhase.number}`
    : null;
  return (
    <div className="flex flex-col gap-3" data-testid="impl-progress">
      <PhasesBar phases={phases} activeKey={activeKey} />
      {activePhase && (
        <section
          className="flex flex-col gap-1"
          data-testid="phase-bar-active"
          data-phase={activeKey}
        >
          <PhaseBar phase={activePhase} />
          {active?.hint ? (
            <p className="text-xs text-amber-700">
              {active.hint} — the active phase is the first open one in document
              order
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
