/**
 * What a plan's page offers (workbench-plan-authoring D9, A10): Continue
 * planning and Approve while it is being written, Build once it is approved,
 * and Review when its build reaches review. A plan is "started" when it
 * lives on its own branch in normal mode (its worktree) or names its code in
 * a workbench (its `code.json`); either way it gets the same buttons at the
 * same moments. The commands decide; this only offers them.
 *
 * Approve follows the package's `planWaiting`: it is offered only when the
 * plan waits on approval (`waitingOn`), never on the impl's existence alone.
 *
 * promise: a-plan-can-start-from-the-admin
 * promise: approval-waits-for-a-finished-plan
 */

import type { WaitingOn } from "@infinitedusky/indusk-mcp/plans/waiting";

export interface PlanActionInput {
  /** Normal mode: the worktree the plan is assigned to. */
  worktree?: unknown;
  /** Workbench: the code its `code.json` names. */
  code?: unknown;
  /** The impl's `status`, when it has an impl. */
  implStatus?: string;
  /** The plan's lifecycle position. */
  position?: string;
  /** What the package's `planWaiting` lists the plan as waiting on, if anything. */
  waitingOn?: WaitingOn;
}

export interface PlanActions {
  canPlan: boolean;
  canApprove: boolean;
  showBuild: boolean;
  canBuild: boolean;
  inReview: boolean;
}

const BUILDING = ["approved", "in-progress", "completed"];

export function planActions(p: PlanActionInput): PlanActions {
  const started = p.worktree !== undefined || p.code !== undefined;
  const building =
    p.implStatus !== undefined && BUILDING.includes(p.implStatus);
  const inReview = p.position === "review";
  return {
    canPlan: started && !building,
    canApprove: started && p.waitingOn === "approval",
    showBuild: started && building,
    canBuild: started && building && p.implStatus !== "completed" && !inReview,
    inReview: started && building && inReview,
  };
}
