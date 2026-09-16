import {
  PLAN_POSITIONS,
  type PlanPositionState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import { Bar, type BarSegment } from "./Bar";
import { POSITION_LABELS } from "./labels";

export interface MasterBarEntry {
  name: string;
  /** Absent for a declared-but-uncreated subplan — a pending segment. */
  position?: PlanPositionState;
}

const ARCHIVED_INDEX = PLAN_POSITIONS.indexOf("archived");

/**
 * The master bar: one segment per declared subplan, in declared order,
 * filled by how far each subplan is through its own lifecycle. Closed
 * subplans are full, in-flight ones partial, declared-but-missing ones empty.
 * It grows as plans are declared and fills as they close.
 */
export function MasterBar({ subplans }: { subplans: MasterBarEntry[] }) {
  let closed = 0;
  let executing = 0;
  const segments: BarSegment[] = subplans.map((entry) => {
    if (!entry.position) {
      return {
        key: entry.name,
        state: "pending",
        label: `${entry.name}: not started`,
      };
    }
    const index = PLAN_POSITIONS.indexOf(entry.position.position);
    if (entry.position.position === "archived") {
      closed++;
      return {
        key: entry.name,
        state: "done",
        label: `${entry.name}: archived`,
      };
    }
    if (entry.position.position === "executing") executing++;
    return {
      key: entry.name,
      state: "active",
      label: `${entry.name}: ${POSITION_LABELS[entry.position.position]}`,
      short: entry.name,
      fill: ARCHIVED_INDEX > 0 ? index / ARCHIVED_INDEX : 0,
    };
  });
  return (
    <Bar
      segments={segments}
      activeLabel={`${closed} of ${subplans.length} closed, ${executing} executing`}
      testId="master-bar"
      labels
    />
  );
}
