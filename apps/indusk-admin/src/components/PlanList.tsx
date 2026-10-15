import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import type { PlanDates } from "@infinitedusky/indusk-mcp/promises/display";
import { EmptyPlansSidebarSlot } from "@/components/EmptyPlansSidebarSlot";
import { HoldingBadge } from "@/components/HoldingBadge";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/Badge";
import { statusToBadge } from "@/components/ui/badge-variant";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { WorktreeChip } from "@/components/Worktrees";
import { declaredWithin } from "@/lib/path-nesting";
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
  /**
   * "holding N" per plan name (day-promises): how many promises a plan owns
   * that are not retired. Rendered on archived plans only — closed is the
   * resting state, and the count is what keeps a closed plan on the hook.
   */
  holding?: Map<string, number>;
  /** Plans holding a violated promise (day-monitor): drawn red without being opened. */
  red?: Set<string>;
  /**
   * When each plan shipped, by name — the package's `planDates` (via
   * `readHealthNames`), never derived here. A Path counts a plan released when
   * its entry has a `released`.
   */
  dates?: Record<string, PlanDates>;
}

/** One declared entry of a Path, in the order its master declares it. */
type PathEntry =
  | { kind: "plan"; plan: Plan; number: number }
  | { kind: "path"; group: PlanGroup; number: number }
  | { kind: "placeholder"; name: string; number: number };

/** A Path: a parent plan with its declared entries, nested as deep as declared. */
interface PlanGroup {
  parent: Plan;
  /** 1 for a Path at the top, one more for each Path declared inside it. */
  depth: number;
  entries: PathEntry[];
  /** Plans in this Path and the Paths inside it (placeholders count as not released). */
  total: number;
  released: number;
}

/**
 * Split plans into Paths and everything else.
 *
 * promise: paths-keep-their-order
 *
 * The invariant this function exists to protect: **every plan passed in comes
 * back out**, either inside a Path or in `rest`. Declarations add structure;
 * they never subtract a plan. A declared child with no folder becomes a
 * placeholder rather than silently vanishing, and a parent with no resolvable
 * children is not a Path at all — it stays an ordinary plan.
 *
 * A subplan that is itself a parent opens as a Path inside its parent, to any
 * depth. A master naming its own ancestor stops at the repeat; a plan declared
 * under two parents appears under both. Children resolve against active
 * AND archived plans (active wins a name collision) — an archived subplan is
 * finished work and renders with its real status, never as a "not created
 * yet" placeholder (T11). `rest` is the unclaimed ACTIVE plans; archived plans
 * always keep their own section.
 */
function buildGroups(
  active: Plan[],
  archived: Plan[],
  grouping: PlanDeclarations | undefined,
  isReleased: (plan: string) => boolean,
): {
  root: { name: string; title: string } | null;
  groups: PlanGroup[];
  rest: Plan[];
} {
  if (!grouping) return { root: null, groups: [], rest: active };

  const byName = new Map(
    [...archived, ...active].map((p) => [p.name, p] as const),
  );
  const claimed = new Set<string>();
  const opened = new Set<string>();

  const open = (
    parentName: string,
    depth: number,
    ancestors: readonly string[],
  ): PlanGroup | null => {
    const parent = byName.get(parentName);
    const declared = grouping.subplans[parentName] ?? [];
    if (!parent || declared.length === 0 || ancestors.includes(parentName)) {
      return null;
    }
    opened.add(parentName);
    claimed.add(parentName);
    const lineage = [...ancestors, parentName];

    const group: PlanGroup = {
      parent,
      depth,
      entries: [],
      total: 0,
      released: 0,
    };
    let number = 0;
    // A plan a Path inside this one also declares is listed there, innermost.
    const listedInside = declaredWithin(grouping.subplans, parentName);
    for (const childName of declared) {
      // A master naming its own ancestor stops at the repeat.
      if (lineage.includes(childName)) continue;
      if (listedInside.has(childName)) continue;
      const nested = open(childName, depth + 1, lineage);
      number += 1;
      if (nested) {
        group.entries.push({ kind: "path", group: nested, number });
        group.total += nested.total;
        group.released += nested.released;
        continue;
      }
      const child = byName.get(childName);
      if (child) {
        claimed.add(childName);
        group.entries.push({ kind: "plan", plan: child, number });
        group.total += 1;
        if (isReleased(childName)) group.released += 1;
      } else {
        group.entries.push({ kind: "placeholder", name: childName, number });
        group.total += 1;
      }
    }
    return group;
  };

  // Top-level Paths: the roadmap's, in its declared order (T13), then any other
  // parent no master declares inside another, in declaration order. A parent
  // declared inside another opens there — unless declarations are a cycle with
  // no entry point, which the last pass opens.
  const parents = Object.keys(grouping.subplans);
  const declaredInside = new Set(
    Object.entries(grouping.subplans).flatMap(([parent, kids]) =>
      kids.filter((k) => k !== parent),
    ),
  );

  const groups: PlanGroup[] = [];
  for (const name of [
    ...grouping.roadmap,
    ...parents.filter((p) => !declaredInside.has(p)),
    ...parents,
  ]) {
    if (opened.has(name)) continue;
    const group = open(name, 1, []);
    if (group) groups.push(group);
  }

  return {
    root: grouping.root ?? null,
    groups,
    rest: active.filter((p) => !claimed.has(p.name)),
  };
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
  holding,
  red,
  dates,
}: PlanListProps) {
  if (active.length === 0 && archived.length === 0) {
    return <EmptyPlansSidebarSlot />;
  }

  const { root, groups, rest } = buildGroups(
    active,
    archived,
    grouping,
    (name) => (dates?.[name]?.released ?? null) !== null,
  );
  const orderedActive = orderByMaster(rest, masterOrder);
  const unordered = rest.filter((p) => !masterOrder.includes(p.name));

  // The root master is one node with the parents and the unclaimed plans
  // beneath it (admin-ui-phase-progress A20): unclaimed plans are the root's
  // leftover bucket, not the parents' peers. Archived stays outside.
  const tree = (
    <>
      {groups.map((group) => (
        <PlanGroupSection
          key={group.parent.name}
          group={group}
          prefix={planHrefPrefix}
          red={red}
        />
      ))}

      {orderedActive.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="px-2 text-xs uppercase tracking-wide text-gray-400">
            Active plans
          </span>
          <ul className="flex flex-col gap-1" data-testid="active-plans">
            {orderedActive.map((plan) => (
              <PlanItem
                key={plan.name}
                plan={plan}
                prefix={planHrefPrefix}
                red={red?.has(plan.name)}
              />
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
              <PlanItem
                key={plan.name}
                plan={plan}
                prefix={planHrefPrefix}
                red={red?.has(plan.name)}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {root ? (
        <div className="flex flex-col gap-2" data-testid="plan-tree-root">
          <span
            className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-600"
            title="The root master — .indusk/planning/master.md"
          >
            {root.title}
          </span>
          <div className="ml-3 flex flex-col gap-4 border-l border-gray-200 pl-2">
            {tree}
          </div>
        </div>
      ) : (
        tree
      )}

      {archived.length > 0 && (
        <CollapsibleSection
          title={`Archived (${archived.length})`}
          defaultOpen={false}
        >
          <ul className="flex flex-col gap-1" data-testid="archived-plans">
            {archived.map((plan) => (
              <PlanItem
                key={plan.name}
                plan={plan}
                prefix={planHrefPrefix}
                holding={holding?.get(plan.name) ?? 0}
                red={red?.has(plan.name)}
              />
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
}

/**
 * A Path: the parent plan, how many of its plans a release has shipped, and
 * its declared entries numbered in declared order — a Path declared inside it
 * opens as a Path inside, indented one level more.
 *
 * Placeholders (declared subplans with no folder yet) render greyed and
 * non-navigable — there is no page to open. Showing them is the point: the
 * sidebar becomes the sequence, including the work queued ahead.
 */
function PlanGroupSection({
  group,
  prefix,
  red,
  number,
}: {
  group: PlanGroup;
  prefix: string;
  red?: Set<string>;
  number?: number;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      data-testid={`plan-group-${group.parent.name}`}
      data-parent={group.parent.name}
      data-depth={group.depth}
    >
      <div className="flex items-center gap-1">
        <ul className="flex min-w-0 flex-1 flex-col gap-1">
          <PlanItem
            plan={group.parent}
            prefix={prefix}
            red={red?.has(group.parent.name)}
            number={number}
          />
        </ul>
        <span
          data-testid="path-released"
          title={`${group.released} of ${group.total} released`}
          className="shrink-0 rounded bg-gray-100 px-1.5 text-xs tabular-nums text-gray-600"
        >
          {group.released}/{group.total}
        </span>
      </div>
      <ul className="ml-3 flex flex-col gap-1 border-l border-gray-200 pl-2">
        {group.entries.map((entry) =>
          entry.kind === "plan" ? (
            <PlanItem
              key={entry.plan.name}
              plan={entry.plan}
              prefix={prefix}
              red={red?.has(entry.plan.name)}
              number={entry.number}
            />
          ) : entry.kind === "path" ? (
            <li key={entry.group.parent.name}>
              <PlanGroupSection
                group={entry.group}
                prefix={prefix}
                red={red}
                number={entry.number}
              />
            </li>
          ) : (
            <li key={entry.name} data-testid={`plan-placeholder-${entry.name}`}>
              <div
                className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-400"
                title="Declared in the parent's master.md — not created yet"
              >
                <span className="truncate">
                  <PlanNumber number={entry.number} />
                  {entry.name}
                </span>
                <Badge variant="neutral">queued</Badge>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function PlanNumber({ number }: { number?: number }) {
  if (number === undefined) return null;
  return (
    <span
      data-testid="plan-number"
      className="mr-1.5 tabular-nums text-xs text-gray-400"
    >
      {number}
    </span>
  );
}

function PlanItem({
  plan,
  prefix,
  holding = 0,
  red = false,
  number,
}: {
  plan: Plan;
  prefix: string;
  holding?: number;
  red?: boolean;
  number?: number;
}) {
  return (
    <li>
      <NavLink
        href={`${prefix}${plan.name}`}
        className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        data-plan-name={plan.name}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="truncate">
            <PlanNumber number={number} />
            {plan.name}
          </span>
          {plan.malformed && (
            <Badge variant="blocked" data-testid={`malformed-${plan.name}`}>
              malformed
            </Badge>
          )}
          <WorktreeChip plan={plan} />
          <HoldingBadge count={holding} plan={plan.name} />
          {red && (
            <span
              role="img"
              data-testid="plan-health"
              data-plan={plan.name}
              data-health="red"
              aria-label="holds a promise violated in the window"
              title="holds a promise violated in the window"
              className="h-2 w-2 shrink-0 rounded-full bg-red-600"
            />
          )}
        </span>
        <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
      </NavLink>
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
