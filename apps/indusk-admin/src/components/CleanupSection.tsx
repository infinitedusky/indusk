import { RitualPhaseSection } from "@/components/phases/RitualPhaseSection";
import type { Phase } from "@/lib/phases";

/**
 * The cleanup ritual's phase (admin-ui-phase-progress, A27): its rows are the
 * tests of any new unit, its items the extractions and the recorded
 * leave-as-is decisions. One configuration of `RitualPhaseSection` — it was
 * a near-byte copy of the falsification one until the cleanup phase (A35).
 */
export function CleanupSection({
  planName,
  phase,
}: {
  planName: string;
  phase: Phase;
}) {
  return (
    <RitualPhaseSection ritual="cleanup" planName={planName} phase={phase} />
  );
}
