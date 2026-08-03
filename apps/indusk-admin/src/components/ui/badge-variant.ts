import type { BadgeVariant } from "@/components/ui/Badge";

/**
 * Shared string→BadgeVariant maps. Extracted (dawn-ui-plan-grouping cleanup)
 * from verbatim-identical copies in PlanList.tsx and PlanDetail.tsx — one
 * source so a new status convention is mapped in exactly one place.
 */

/**
 * Map a free-form `status` string from frontmatter to a Badge variant. Unknown
 * statuses fall back to `neutral` so the UI never breaks on a new convention.
 */
export function statusToBadge(status: string): BadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized.includes("completed") || normalized.includes("passing"))
    return "passing";
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("in-progress") || normalized.includes("accepted"))
    return "writable";
  if (normalized.includes("draft") || normalized.includes("planned"))
    return "planned";
  return "neutral";
}

/** Map a trajectory-row state to its Badge variant; unknown states → neutral. */
export function stateToBadge(state: string): BadgeVariant {
  const normalized = state.toLowerCase();
  if (
    [
      "passing",
      "blocked",
      "skipped",
      "planned",
      "writable",
      "written",
    ].includes(normalized)
  ) {
    return normalized as BadgeVariant;
  }
  return "neutral";
}
