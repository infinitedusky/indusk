import Link from "next/link";
import { EmptyPlansSidebarSlot } from "@/components/EmptyPlansSidebarSlot";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { Plan } from "@/lib/planning-reader";

interface PlanListProps {
  active: Plan[];
  archived: Plan[];
  /**
   * Plan names in the order declared by `master.md`. Plans not in this list
   * appear in an "Unordered" group at the bottom of the active section.
   */
  masterOrder: string[];
}

/**
 * Sidebar plan list:
 *   - Active plans, ordered per `master.md` (T3); plans not in master.md
 *     appear in an "Unordered" group at the bottom.
 *   - Archived plans in a collapsed CollapsibleSection (T4) below the active list.
 *   - Empty state (no plans at all) renders the EmptyPlansSidebarSlot (T12,
 *     preserving Phase 1 behavior).
 */
export function PlanList({ active, archived, masterOrder }: PlanListProps) {
  if (active.length === 0 && archived.length === 0) {
    return <EmptyPlansSidebarSlot />;
  }

  const orderedActive = orderByMaster(active, masterOrder);
  const unordered = active.filter((p) => !masterOrder.includes(p.name));

  return (
    <div className="flex flex-col gap-4">
      {orderedActive.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="active-plans">
          {orderedActive.map((plan) => (
            <PlanItem key={plan.name} plan={plan} />
          ))}
        </ul>
      )}

      {unordered.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="px-2 text-xs uppercase tracking-wide text-gray-400">
            Unordered
          </span>
          <ul className="flex flex-col gap-1" data-testid="unordered-plans">
            {unordered.map((plan) => (
              <PlanItem key={plan.name} plan={plan} />
            ))}
          </ul>
        </div>
      )}

      {archived.length > 0 && (
        <CollapsibleSection
          title={`Archived (${archived.length})`}
          defaultOpen={false}
        >
          <ul className="flex flex-col gap-1" data-testid="archived-plans">
            {archived.map((plan) => (
              <PlanItem key={plan.name} plan={plan} />
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
}

function PlanItem({ plan }: { plan: Plan }) {
  return (
    <li>
      <Link
        href={`/plan/${plan.name}`}
        className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        data-plan-name={plan.name}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="truncate">{plan.name}</span>
          {plan.malformed && (
            <Badge variant="blocked" data-testid={`malformed-${plan.name}`}>
              malformed
            </Badge>
          )}
        </span>
        <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
      </Link>
    </li>
  );
}

function orderByMaster(plans: Plan[], masterOrder: string[]): Plan[] {
  const byName = new Map(plans.map((p) => [p.name, p]));
  const out: Plan[] = [];
  for (const name of masterOrder) {
    const p = byName.get(name);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Map a free-form `status` string from frontmatter to a Badge variant. Unknown
 * statuses fall back to `neutral` so the UI never breaks on a new convention.
 */
function statusToBadge(status: string): BadgeVariant {
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
