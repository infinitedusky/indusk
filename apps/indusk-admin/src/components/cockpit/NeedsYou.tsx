import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { NavLink } from "@/components/NavLink";

/**
 * The nav's *Needs you* (plan-cockpit, ADR decision 2): each plan waiting on
 * the person, by title, with the step it waits at, linking to the plan's page
 * where its decision card is. Nothing when no plan waits.
 *
 * promise: decisions-wait-in-one-place
 */
export function NeedsYou({
  project,
  waiting,
  titles,
}: {
  project: string;
  waiting: Waiting[];
  titles: Record<string, string>;
}) {
  if (waiting.length === 0) return null;
  return (
    <nav
      className="flex flex-col gap-1 border-t border-gray-200 py-3"
      data-testid="needs-you"
    >
      <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
        Needs you
      </h3>
      {waiting.map((w) => (
        <NavLink
          key={w.plan}
          href={`/p/${project}/plan/${w.plan}`}
          data-needs-you={w.plan}
          className="flex items-baseline justify-between gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          <span className="truncate">{titles[w.plan] ?? w.plan}</span>
          <span
            data-testid="needs-you-step"
            className="shrink-0 text-xs text-amber-700"
          >
            {w.step}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
