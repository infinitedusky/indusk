import { statusToNavMark } from "@/components/ui/badge-variant";
import type { Plan } from "@/lib/planning-reader";

/**
 * What a plan's stage reads: what it waits on, else Released, else its
 * status. The nav row and the master page both ask this, so they cannot
 * disagree.
 *
 * promise: a-master-plan-tells-its-story
 */
export function planStage(
  plan: Plan,
  released: boolean,
  waiting: Record<string, string> | undefined,
): string {
  return (
    waiting?.[plan.name] ??
    (released ? "Released" : statusToNavMark(plan.status, plan.archived).stage)
  );
}
