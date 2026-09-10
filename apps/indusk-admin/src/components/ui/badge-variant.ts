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

/**
 * A paper's badge. `published (stale)` is the derived label for a published
 * paper whose plan copy has changed since; it is a signal a publish is owed,
 * so it reads as written (in hand, not final) rather than passing.
 */
export function paperStatusToBadge(
  status: string,
  stale: boolean,
): BadgeVariant {
  if (status === "malformed") return "blocked";
  if (status === "draft") return "planned";
  if (status === "accepted") return "writable";
  if (status === "published") return stale ? "written" : "passing";
  return "neutral";
}

/** The label beside a paper: its status, or `published (stale)` when derived stale. */
export function paperStatusLabel(status: string, stale: boolean): string {
  return status === "published" && stale ? "published (stale)" : status;
}
