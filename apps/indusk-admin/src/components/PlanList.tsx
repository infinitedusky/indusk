import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import type { PlanDates } from "@infinitedusky/indusk-mcp/promises/display";
import { NavPlanRow } from "@/components/cockpit/NavItems";
import { EmptyPlansSidebarSlot } from "@/components/EmptyPlansSidebarSlot";
import { HoldingBadge } from "@/components/HoldingBadge";
import { Badge } from "@/components/ui/Badge";
import { NavGroup } from "@/components/ui/Nav";
import { NavPath } from "@/components/ui/NavPath";
import { PlanRow } from "@/components/ui/PlanRow";
import { WorktreeChip } from "@/components/Worktrees";
import { initialsOf } from "@/lib/initials";
import { buildGroups, orderByMaster, type PlanGroup } from "@/lib/plan-groups";
import { navMarkOf } from "@/lib/plan-stage";
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
  /** Plans holding a broken promise (day-monitor): drawn red without being opened. */
  red?: Set<string>;
  /**
   * When each plan shipped, by name — the package's `planDates` (via
   * `readHealthNames`), never derived here. A Path counts a plan released when
   * its entry has a `released`.
   */
  dates?: Record<string, PlanDates>;
  /**
   * The step each plan waiting on the person waits at, by plan name — the
   * package's `planWaiting`. A plan in it reads *needs you* in the tree, as it
   * does in the nav's Needs you group.
   */
  waiting?: Record<string, string>;
  /** The project's product words, for a queued plan with no title declared. */
  words?: Record<string, string>;
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
  waiting,
  words,
}: PlanListProps) {
  if (active.length === 0 && archived.length === 0) {
    return <EmptyPlansSidebarSlot />;
  }

  const isReleased = (name: string) =>
    (dates?.[name]?.released ?? null) !== null;
  const { root, groups, rest } = buildGroups(
    active,
    archived,
    grouping,
    isReleased,
    words,
  );
  const orderedActive = orderByMaster(rest, masterOrder);
  const unordered = rest.filter((p) => !masterOrder.includes(p.name));

  // The root master is one node with the parents and the unclaimed plans
  // beneath it (admin-ui-phase-progress A20): unclaimed plans are the root's
  // leftover bucket, not the parents' peers. Archived stays outside.
  const tree = (
    <>
      {groups.length > 0 && <NavGroup label="Paths" count={groups.length} />}
      {groups.map((group) => (
        <PlanGroupSection
          key={group.parent.name}
          group={group}
          prefix={planHrefPrefix}
          red={red}
          waiting={waiting}
          isReleased={isReleased}
        />
      ))}

      {orderedActive.length > 0 && (
        <>
          <NavGroup label="Plans" count={orderedActive.length} />
          <ul className="grid gap-hair" data-testid="active-plans">
            {orderedActive.map((plan) => (
              <PlanItem
                key={plan.name}
                plan={plan}
                prefix={planHrefPrefix}
                red={red?.has(plan.name)}
                released={isReleased(plan.name)}
                waiting={waiting}
              />
            ))}
          </ul>
        </>
      )}

      {unordered.length > 0 && (
        <>
          <NavGroup label="Unordered" count={unordered.length} />
          <ul className="grid gap-hair" data-testid="unordered-plans">
            {unordered.map((plan) => (
              <PlanItem
                key={plan.name}
                plan={plan}
                prefix={planHrefPrefix}
                red={red?.has(plan.name)}
                released={isReleased(plan.name)}
                waiting={waiting}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col">
      {root ? (
        <div className="contents" data-testid="plan-tree-root">
          <div
            className="mx-tight mb-1 mt-3 text-2xs font-semibold uppercase leading-1 tracking-caps text-ink-faint"
            title="The root master — .indusk/planning/master.md"
          >
            {root.title}
          </div>
          {tree}
        </div>
      ) : (
        tree
      )}

      {archived.length > 0 && (
        <NavPath
          apart
          defaultOpen={false}
          name="Archived"
          label={`Archived (${archived.length})`}
          count={archived.length}
        >
          <ul className="grid gap-hair" data-testid="archived-plans">
            {archived.map((plan) => (
              <PlanItem
                key={plan.name}
                plan={plan}
                prefix={planHrefPrefix}
                holding={holding?.get(plan.name) ?? 0}
                red={red?.has(plan.name)}
                released={isReleased(plan.name)}
                waiting={waiting}
              />
            ))}
          </ul>
        </NavPath>
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
  waiting,
  isReleased,
  number,
}: {
  group: PlanGroup;
  prefix: string;
  red?: Set<string>;
  waiting?: Record<string, string>;
  isReleased: (plan: string) => boolean;
  number?: number;
}) {
  const name = group.parent.name;
  return (
    <NavPath
      data-testid={`plan-group-${name}`}
      data-parent={name}
      data-depth={group.depth}
      name={group.parent.title}
      number={number}
      href={`${prefix}${name}`}
      linkProps={{ "data-plan-name": name }}
      mark={red?.has(name) ? <RedDot plan={name} /> : undefined}
      count={
        <span
          data-testid="path-released"
          title={`${group.released} of ${group.total} released`}
        >
          {group.released}/{group.total}
        </span>
      }
    >
      {group.entries.map((entry) =>
        entry.kind === "plan" ? (
          <ul key={entry.plan.name} className="grid">
            <PlanItem
              plan={entry.plan}
              prefix={prefix}
              red={red?.has(entry.plan.name)}
              released={isReleased(entry.plan.name)}
              waiting={waiting}
              number={entry.number}
            />
          </ul>
        ) : entry.kind === "path" ? (
          <PlanGroupSection
            key={entry.group.parent.name}
            group={entry.group}
            prefix={prefix}
            red={red}
            waiting={waiting}
            isReleased={isReleased}
            number={entry.number}
          />
        ) : (
          <div key={entry.name} data-testid={`plan-placeholder-${entry.name}`}>
            <PlaceholderRow title={entry.title} number={entry.number} />
          </div>
        ),
      )}
    </NavPath>
  );
}

/** A declared plan with no folder yet: a row with no page behind it, its stage "Queued". */
function PlaceholderRow({ title, number }: { title: string; number: number }) {
  return (
    <PlanRow
      disabled
      queued
      initials={initialsOf(title)}
      state="idle"
      name={title}
      number={<PlanNumber number={number} />}
      stage="Queued"
      title="Declared in the parent's master.md — not created yet"
    />
  );
}

/** A plan's place in its Path, where a test can find it. */
function PlanNumber({ number }: { number: number }) {
  return <span data-testid="plan-number">{number}</span>;
}

function RedDot({ plan }: { plan: string }) {
  return (
    <span
      role="img"
      data-testid="plan-health"
      data-plan={plan}
      data-health="red"
      aria-label="holds a promise broken in the window"
      title="holds a promise broken in the window"
      className="block size-dot shrink-0 rounded-pill bg-bad"
    />
  );
}

function PlanItem({
  plan,
  prefix,
  holding = 0,
  red = false,
  released = false,
  waiting,
  number,
}: {
  plan: Plan;
  prefix: string;
  holding?: number;
  red?: boolean;
  /** A release shipped it: the stage says Released. */
  released?: boolean;
  waiting?: Record<string, string>;
  number?: number;
}) {
  const mark = navMarkOf(plan, released, waiting);
  return (
    <li>
      <NavPlanRow
        href={`${prefix}${plan.name}`}
        data-plan-name={plan.name}
        initials={initialsOf(plan.title)}
        state={mark.state}
        name={plan.title}
        number={number === undefined ? "" : <PlanNumber number={number} />}
        stage={
          <>
            {mark.stage}
            {plan.malformed && (
              <Badge variant="blocked" data-testid={`malformed-${plan.name}`}>
                malformed
              </Badge>
            )}
            <WorktreeChip plan={plan} />
            <HoldingBadge count={holding} plan={plan.name} />
            {red && <RedDot plan={plan.name} />}
          </>
        }
      />
    </li>
  );
}
