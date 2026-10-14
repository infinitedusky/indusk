import type { ReactNode } from "react";
import { Tag } from "@/components/ui/Tag";
import type { Plan } from "@/lib/planning-reader";

/**
 * The plan page's frame, drawn as the approved mockups draw it (`plan.parts`,
 * `plan.needs-you`, `plan.working`, `plan.released`): a crumb, the plan's
 * name, the one tag it carries (the worktree it is worked in), and whatever
 * the page places beneath. Nothing else is drawn here — the documents are
 * read on the brief page, which the parts link to.
 */
export function PlanFrame({
  project,
  plan,
  lookState,
  children,
}: {
  project: string;
  plan: Plan;
  /** The look the page really draws (`lib/look-state`), for the look check. */
  lookState: string;
  children: ReactNode;
}) {
  return (
    <article
      className="grid gap-5"
      data-testid="plan-detail"
      data-plan-name={plan.name}
      data-look-state={lookState}
    >
      <header
        className="flex flex-wrap items-center gap-x-5 gap-y-3 pb-hair pt-5"
        data-testid="plan-header"
      >
        <div>
          <div className="text-sm leading-3 text-ink-faint">
            <b className="font-medium text-ink-soft">{project}</b> / Plans /{" "}
            {plan.name}
          </div>
          <h1 className="font-display text-4xl font-bold leading-7">
            {plan.name}
          </h1>
        </div>
        {plan.worktree ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Tag
              data-testid="plan-worktree"
              title={`Read from the worktree at ${plan.worktree.path}`}
            >
              worktree {plan.worktree.branch}
            </Tag>
          </div>
        ) : null}
      </header>
      {children}
    </article>
  );
}
