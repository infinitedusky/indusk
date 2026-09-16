import type { Phase } from "@/lib/phases";
import { Bar, type BarSegment } from "./Bar";
import { ACTIVITY_LABELS, STAGE_LABELS } from "./labels";

/**
 * The phase bar: the stages inside one phase (implementation items, then each
 * gate) filling in order. The active stage is partially filled by its own
 * n of m and labelled with the phase's verb — "verifying: 2 of 5".
 */
export function PhaseBar({ phase }: { phase: Phase }) {
  const segments: BarSegment[] = phase.stages.map((stage) => ({
    key: stage.kind,
    state: stage.state,
    label: `${STAGE_LABELS[stage.kind]}: ${stage.checked} of ${stage.total}`,
    fill: stage.total === 0 ? 0 : stage.checked / stage.total,
  }));
  const active = phase.stages.find((s) => s.state === "active");
  const activeLabel = active
    ? `${ACTIVITY_LABELS[phase.activity]}: ${active.checked} of ${active.total}`
    : ACTIVITY_LABELS[phase.activity];
  return (
    <Bar segments={segments} activeLabel={activeLabel} testId="phase-bar" />
  );
}
