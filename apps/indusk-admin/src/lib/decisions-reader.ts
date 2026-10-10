import type { DecisionEntry } from "@infinitedusky/indusk-mcp/plans/history";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import type { Plan } from "./planning-reader";

/** What the project's plans wait on, and a plan's recorded decisions. Stub — Build Phase 6. */
export function readWaiting(_project: string, _plans: Plan[]): Waiting[] {
  return [];
}

export function readPlanHistory(
  _projectPath: string,
  _plan: string,
): DecisionEntry[] {
  return [];
}
