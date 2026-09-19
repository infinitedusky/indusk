import {
  PLAN_POSITIONS,
  type PlanPositionState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import { Bar, type BarSegment } from "./Bar";
import { POSITION_LABELS } from "./labels";

/**
 * The plan bar: every lifecycle position, research through archived, with
 * the current one active and labelled with what it awaits. The same steps on
 * every plan whether reached or not — the bar doubles as the definition of
 * what a plan requires (Sandy, 2026-09-16). Skipped positions are drawn as
 * skipped, so two plans at different positions have bars of the same shape.
 *
 * When the plan is executing, the label is pulled up from the phase bar:
 * "executing: verifying Build Phase 2".
 */
export function PlanBar({
  position,
  activity,
}: {
  position: PlanPositionState;
  /** The active phase's verb and name, when the plan is executing. */
  activity?: string | null;
}) {
  // Every segment is a step, drawn half-filled when active — except
  // `monitor`, which is time: it fills with the share of the quiet window
  // that has passed (day-monitor, ADR D8).
  const monitor = position.monitor;
  const segments: BarSegment[] = PLAN_POSITIONS.map((key) => ({
    key,
    state: position.segments[key],
    label: POSITION_LABELS[key],
    fill:
      key === "monitor" && monitor
        ? Math.min(1, monitor.elapsedDays / monitor.windowDays)
        : 0.5,
  }));
  const activeLabel =
    position.position === "executing" && activity
      ? `executing: ${activity}`
      : position.awaiting;
  return (
    <Bar
      segments={segments}
      activeLabel={activeLabel}
      caption={
        monitor
          ? "steps, then time: monitor fills as the quiet window passes"
          : "steps, not time"
      }
      testId="plan-bar"
      labels
    />
  );
}
