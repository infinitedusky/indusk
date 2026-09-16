import { type Phase, phaseTitle } from "@/lib/phases";
import { Bar, type BarSegment } from "./Bar";
import { STAGE_LABELS } from "./labels";

/**
 * The phase line: every phase of the impl in document order — Test Phase 1,
 * the build phases, the ritual phases — with closed ones full, the active
 * one partially filled by its own items and named, later ones empty. It sits
 * between the plan bar (where the plan stands) and the active phase's stage
 * bar (what is happening inside that phase), so the three lines read as one
 * zoom: position → phase → stage (Sandy, 2026-09-16).
 */
export function PhasesBar({
  phases,
  activeKey,
}: {
  phases: Phase[];
  /** `kind-number` of the active phase; null when nothing is being worked. */
  activeKey: string | null;
}) {
  const segments: BarSegment[] = phases.map((phase) => {
    const key = `${phase.kind}-${phase.number}`;
    const total = phase.stages.reduce((n, s) => n + s.total, 0);
    const checked = phase.stages.reduce((n, s) => n + s.checked, 0);
    const state =
      key === activeKey
        ? "active"
        : phase.activity === "closed"
          ? "done"
          : "pending";
    return {
      key,
      state,
      label: `${phaseTitle(phase)}${phase.title ? `: ${phase.title}` : ""} — ${checked} of ${total}`,
      short: phaseTitle(phase),
      fill: total === 0 ? 0 : checked / total,
    };
  });
  // Each line names the level below it: the plan bar says which phase, this
  // line says which stage of that phase, the stage bar says what is being
  // worked (Sandy, U1 review).
  const active = phases.find((p) => `${p.kind}-${p.number}` === activeKey);
  const activeStage = active?.stages.find((s) => s.state === "active");
  const activeLabel = active
    ? `${phaseTitle(active)}: ${activeStage ? STAGE_LABELS[activeStage.kind] : active.title}`
    : null;
  return (
    <Bar
      segments={segments}
      activeLabel={activeLabel}
      testId="phases-bar"
      labels
    />
  );
}
