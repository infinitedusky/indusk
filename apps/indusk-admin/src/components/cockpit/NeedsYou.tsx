import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { NavPlanRow } from "@/components/cockpit/NavItems";
import { NavGroup } from "@/components/ui/Nav";
import { initialsOf } from "@/lib/initials";

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
    <div className="contents" data-testid="needs-you">
      <NavGroup label="Needs you" count={waiting.length} />
      {waiting.map((w) => {
        const name = titles[w.plan] ?? w.plan;
        return (
          <NavPlanRow
            key={w.plan}
            href={`/p/${project}/plan/${w.plan}`}
            data-needs-you={w.plan}
            initials={initialsOf(name)}
            state="needs"
            name={name}
            stage={<span data-testid="needs-you-step">{w.step}</span>}
          />
        );
      })}
    </div>
  );
}
