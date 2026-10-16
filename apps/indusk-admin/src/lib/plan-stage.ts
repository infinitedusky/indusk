import { stepAt } from "@infinitedusky/indusk-mcp/plans/steps";
import { snapshotOf } from "@/lib/plan-snapshot";
import type { Plan } from "@/lib/planning-reader";

/** How a plan reads in the nav: the mark's state and the words under its name. */
export interface NavMark {
  state: "needs" | "working" | "released" | "idle";
  stage: string;
}

/**
 * A plan's mark in the nav: what it waits on, else Released from a release's
 * date, else the step the package says it is at (`stepAt`, the step its page
 * shows), else Closed for a closed plan. Never the impl's `status:`, which
 * `/work` sets to completed before the rituals have run.
 *
 * promise: the-nav-says-where-a-plan-is
 */
export function navMarkOf(
  plan: Plan,
  released: boolean,
  waiting: Record<string, string> | undefined,
): NavMark {
  const waitingAt = waiting?.[plan.name];
  if (waitingAt !== undefined) return { state: "needs", stage: waitingAt };
  if (released) return { state: "released", stage: "Released" };
  const step = stepAt(snapshotOf(plan));
  if (step)
    return {
      state: step.workflow === "release" ? "working" : "idle",
      stage: step.name,
    };
  if (plan.archived) return { state: "released", stage: "Closed" };
  return { state: "idle", stage: plan.status };
}

/**
 * What a plan's stage reads. The nav row and the master page both ask this,
 * so they cannot disagree.
 *
 * promise: a-master-plan-tells-its-story
 */
export function planStage(
  plan: Plan,
  released: boolean,
  waiting: Record<string, string> | undefined,
): string {
  return navMarkOf(plan, released, waiting).stage;
}

/**
 * Whether any plan is at a build-or-later step (the project card's "work in
 * progress"): the nav's own `working` mark, never the impl's `status:`.
 *
 * promise: the-nav-says-where-a-plan-is
 */
export function hasWorkInProgress(plans: ReadonlyArray<Plan>): boolean {
  return plans.some((p) => navMarkOf(p, false, undefined).state === "working");
}
