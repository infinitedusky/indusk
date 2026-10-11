import type { PlanDates } from "@infinitedusky/indusk-mcp/promises/display";
import { HoldingBadge } from "@/components/HoldingBadge";
import { PlanTypeChip } from "@/components/PlanTypeChip";
import { Badge } from "@/components/ui/Badge";
import { statusToBadge } from "@/components/ui/badge-variant";
import { CopyButton } from "@/components/ui/CopyButton";
import { WorktreeChip } from "@/components/Worktrees";
import { planMarkdown } from "@/lib/markdown-export";
import type { Plan } from "@/lib/planning-reader";

/**
 * A plan page's header (plan-cockpit, ADR decision 3): the plan's name or
 * title, its status, type and worktree, and the facts the package read for it
 * — dates, the Paths that declare it, the promises it owns with their tests.
 * Split from `PlanDetail`, which lays out the sections beneath it.
 */

/** A promise this plan owns, as the header shows it: its sentence and its tests, both from the package. */
export interface PlanPromiseChip {
  name: string;
  sentence: string;
  standing: string;
  tests: { passing: number; total: number };
}

/** The facts the header adds to the plan's name; every one is read by the package, none worked out here. */
export interface PlanHeaderFacts {
  title?: string;
  dates?: PlanDates;
  /** The Paths (parent plans) that declare this plan, outermost first. */
  paths?: string[];
  promises?: PlanPromiseChip[];
}

/**
 * The project's Promises page, beside its plan pages: a plan is at
 * `<base>/plan/<name>`, the registry at `<base>/promises`.
 */
export function promisesHrefFrom(planHrefPrefix: string): string {
  return planHrefPrefix.replace(/plan\/$/, "promises");
}

export function PlanHeader({
  plan,
  holding = 0,
  showType = false,
  facts,
  planHrefPrefix,
}: {
  plan: Plan;
  holding?: number;
  /**
   * Whether the type chip is drawn — true whenever the plan bar is. The bar
   * can say "this plan declares no type" under itself, and a page that says
   * so must carry the chip that says it and explains it (A24). A parent has
   * a master bar, no plan bar, and no document to declare a type in.
   */
  showType?: boolean;
  facts?: PlanHeaderFacts;
  planHrefPrefix: string;
}) {
  const title = facts?.title && facts.title !== plan.name ? facts.title : null;
  return (
    <header
      className="flex flex-col gap-3 border-b border-gray-200 pb-3"
      data-testid="plan-header"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-gray-900">
            {title ?? plan.name}
          </h1>
          {title && (
            <span className="font-mono text-xs text-gray-500">{plan.name}</span>
          )}
          <span className="flex items-center gap-2 text-xs text-gray-500">
            {plan.archived ? "archived" : "active"}
            {showType && (
              <PlanTypeChip
                workflow={plan.workflow ?? null}
                declared={plan.workflowDeclared ?? null}
              />
            )}
            <WorktreeChip plan={plan} />
            <HoldingBadge count={holding} plan={plan.name} />
          </span>
          <HeaderFacts facts={facts} planHrefPrefix={planHrefPrefix} />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
          <CopyButton
            text={planMarkdown(plan)}
            label="Copy whole plan as markdown"
            data-testid="copy-plan-button"
          />
        </div>
      </div>
    </header>
  );
}

/** "started 2026-09-01 · landed 2026-09-20 · released 1.70.0 (2026-10-02)", only what has happened. */
function datesLine(dates: PlanDates): string {
  return [
    dates.started ? `started ${dates.started}` : null,
    dates.landed ? `landed ${dates.landed}` : null,
    dates.released
      ? `released ${dates.released.version} (${dates.released.date})`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function HeaderFacts({
  facts,
  planHrefPrefix,
}: {
  facts?: PlanHeaderFacts;
  planHrefPrefix: string;
}) {
  if (!facts) return null;
  const promisesHref = promisesHrefFrom(planHrefPrefix);
  const dates = facts.dates ? datesLine(facts.dates) : "";
  const paths = facts.paths ?? [];
  const promises = facts.promises ?? [];
  if (!dates && paths.length === 0 && promises.length === 0) return null;
  return (
    <div
      className="mt-2 flex flex-col gap-1 text-xs text-gray-600"
      data-testid="plan-header-facts"
    >
      {dates && <span data-testid="plan-dates">{dates}</span>}
      {paths.length > 0 && (
        <span data-testid="plan-path">
          Path:{" "}
          {paths.map((path, i) => (
            <span key={path}>
              {i > 0 && " › "}
              <a className="underline" href={`${planHrefPrefix}${path}`}>
                {path}
              </a>
            </span>
          ))}
        </span>
      )}
      {promises.length > 0 && (
        <ul className="flex flex-wrap gap-1" data-testid="plan-promises">
          {promises.map((p) => (
            <li key={p.name}>
              <a
                href={`${promisesHref}/${p.name}`}
                title={`${p.sentence} — ${p.standing}`}
                data-standing={p.standing}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5"
              >
                {p.sentence}
                <span className="text-gray-500">
                  {p.tests.passing}/{p.tests.total} tests
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
