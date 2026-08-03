import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import Link from "next/link";
import { EmptyPlansSidebarSlot } from "@/components/EmptyPlansSidebarSlot";
import { Badge } from "@/components/ui/Badge";
import { statusToBadge } from "@/components/ui/badge-variant";
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
  /**
   * Route prefix for a plan's link. Defaults to `/plan/` so existing
   * single-project tests keep working; the per-project layout (admin-ui-hosting
   * Phase 3) passes `/p/{project}/plan/` to namespace links under the
   * project segment.
   */
  planHrefPrefix?: string;
  /**
   * Plan hierarchy declarations (dawn-ui-plan-grouping). Parents render as
   * groups with their declared children beneath. Omitted → today's flat list,
   * which is also the fallback whenever a declaration is missing or unreadable.
   */
  grouping?: PlanDeclarations;
}

/** A parent plan plus its children, resolved against what exists on disk. */
interface PlanGroup {
  parent: Plan;
  /** Children that exist, in declared order. */
  children: Plan[];
  /** Declared names with no plan folder yet — rendered as placeholders. */
  placeholders: string[];
}

/**
 * Split plans into parent groups and everything else.
 *
 * The invariant this function exists to protect: **every plan passed in comes
 * back out**, either inside a group or in `rest`. Declarations add structure;
 * they never subtract a plan. A declared child with no folder becomes a
 * placeholder rather than silently vanishing, and a parent with no resolvable
 * children is not a group at all — it stays an ordinary plan.
 *
 * Children resolve against active AND archived plans (active wins a name
 * collision) — an archived subplan is finished work and renders with its real
 * status, never as a "not created yet" placeholder (T11). `rest` is the
 * unclaimed ACTIVE plans; archived plans always keep their own section.
 */
function buildGroups(
  active: Plan[],
  archived: Plan[],
  grouping: PlanDeclarations | undefined,
): { groups: PlanGroup[]; rest: Plan[] } {
  if (!grouping) return { groups: [], rest: active };

  const byName = new Map(
    [...archived, ...active].map((p) => [p.name, p] as const),
  );
  const claimed = new Set<string>();
  const groups: PlanGroup[] = [];

  for (const parentName of Object.keys(grouping.subplans)) {
    const parent = byName.get(parentName);
    const declared = grouping.subplans[parentName] ?? [];
    if (!parent || declared.length === 0) continue;

    const children: Plan[] = [];
    const placeholders: string[] = [];
    for (const childName of declared) {
      const child = byName.get(childName);
      if (child) {
        children.push(child);
        claimed.add(childName);
      } else {
        placeholders.push(childName);
      }
    }

    if (children.length === 0 && placeholders.length === 0) continue;
    claimed.add(parentName);
    groups.push({ parent, children, placeholders });
  }

  // Groups follow the roadmap's declared order, not subplans-object iteration
  // order (T13). Parents the roadmap doesn't list follow after, keeping their
  // declaration order (sort is stable).
  const roadmapIndex = new Map(
    grouping.roadmap.map((name, i) => [name, i] as const),
  );
  groups.sort(
    (a, b) =>
      (roadmapIndex.get(a.parent.name) ?? Number.MAX_SAFE_INTEGER) -
      (roadmapIndex.get(b.parent.name) ?? Number.MAX_SAFE_INTEGER),
  );

  return { groups, rest: active.filter((p) => !claimed.has(p.name)) };
}

/**
 * Sidebar plan list:
 *   - Active plans, ordered per `master.md` (T3); plans not in master.md
 *     appear in an "Unordered" group at the bottom.
 *   - Archived plans in a collapsed CollapsibleSection (T4) below the active list.
 *   - Empty state (no plans at all) renders the EmptyPlansSidebarSlot (T12,
 *     preserving Phase 1 behavior).
 *
 * Global navigation (Projects, Scorecards) moved to the root layout's header
 * in admin-ui-hosting Phase 3 — per-project sidebars no longer duplicate the
 * global nav block.
 */
export function PlanList({
  active,
  archived,
  masterOrder,
  planHrefPrefix = "/plan/",
  grouping,
}: PlanListProps) {
  if (active.length === 0 && archived.length === 0) {
    return <EmptyPlansSidebarSlot />;
  }

  const { groups, rest } = buildGroups(active, archived, grouping);
  const orderedActive = orderByMaster(rest, masterOrder);
  const unordered = rest.filter((p) => !masterOrder.includes(p.name));

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <PlanGroupSection
          key={group.parent.name}
          group={group}
          prefix={planHrefPrefix}
        />
      ))}

      {orderedActive.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="px-2 text-xs uppercase tracking-wide text-gray-400">
            Active plans
          </span>
          <ul className="flex flex-col gap-1" data-testid="active-plans">
            {orderedActive.map((plan) => (
              <PlanItem key={plan.name} plan={plan} prefix={planHrefPrefix} />
            ))}
          </ul>
        </div>
      )}

      {unordered.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="px-2 text-xs uppercase tracking-wide text-gray-400">
            Unordered
          </span>
          <ul className="flex flex-col gap-1" data-testid="unordered-plans">
            {unordered.map((plan) => (
              <PlanItem key={plan.name} plan={plan} prefix={planHrefPrefix} />
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
              <PlanItem key={plan.name} plan={plan} prefix={planHrefPrefix} />
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
}

/**
 * A parent plan with its declared children indented beneath it.
 *
 * Placeholders (declared subplans with no folder yet) render greyed and
 * non-navigable — there is no page to open. Showing them is the point: the
 * sidebar becomes the sequence, including the work queued ahead.
 */
function PlanGroupSection({
  group,
  prefix,
}: {
  group: PlanGroup;
  prefix: string;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      data-testid={`plan-group-${group.parent.name}`}
    >
      <ul className="flex flex-col gap-1">
        <PlanItem plan={group.parent} prefix={prefix} />
      </ul>
      <ul className="ml-3 flex flex-col gap-1 border-l border-gray-200 pl-2">
        {group.children.map((plan) => (
          <PlanItem key={plan.name} plan={plan} prefix={prefix} />
        ))}
        {group.placeholders.map((name) => (
          <li key={name} data-testid={`plan-placeholder-${name}`}>
            <div
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-400"
              title="Declared in the parent's master.md — not created yet"
            >
              <span className="truncate">{name}</span>
              <Badge variant="neutral">queued</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanItem({ plan, prefix }: { plan: Plan; prefix: string }) {
  return (
    <li>
      <Link
        href={`${prefix}${plan.name}`}
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
