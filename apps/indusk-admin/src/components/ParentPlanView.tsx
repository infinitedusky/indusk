import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/ui/Badge";
import { statusToBadge } from "@/components/ui/badge-variant";
import type { Plan } from "@/lib/planning-reader";

/** A declared subplan resolved for the parent detail view. */
export interface SubplanEntry {
  /** Declared name from the parent's master.md `subplans:` list. */
  name: string;
  /** The resolved plan when its folder exists; absent → placeholder card. */
  plan?: Plan;
}

/**
 * Detail view for a parent plan — a card per declared subplan, in declared
 * order, rendered ahead of whatever standard document sections the parent
 * carries. Same semantics as the sidebar group: real subplans navigate,
 * declared-but-uncreated ones render as placeholders.
 */
export function ParentPlanView({
  subplans,
  masterContent,
  prefix,
}: {
  subplans: SubplanEntry[];
  masterContent?: string;
  prefix: string;
}) {
  return (
    <>
      {masterContent && (
        <section data-testid="parent-master-prose">
          <Markdown>{masterContent}</Markdown>
        </section>
      )}
      <section className="flex flex-col gap-2" data-testid="subplan-cards">
        <h2 className="text-base font-semibold text-gray-900">Subplans</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {subplans.map((entry) =>
            entry.plan ? (
              <SubplanCard key={entry.name} plan={entry.plan} prefix={prefix} />
            ) : (
              <SubplanPlaceholderCard key={entry.name} name={entry.name} />
            ),
          )}
        </div>
      </section>
    </>
  );
}

function SubplanCard({ plan, prefix }: { plan: Plan; prefix: string }) {
  return (
    <div data-testid={`subplan-card-${plan.name}`}>
      <Link
        href={`${prefix}${plan.name}`}
        className="flex flex-col gap-1 rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-gray-900">
            {plan.name}
          </span>
          <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
        </div>
        <span className="text-xs text-gray-500">{planStage(plan)}</span>
      </Link>
    </div>
  );
}

/**
 * A declared subplan with no folder yet — same semantics as the sidebar's
 * greyed placeholder: visually distinct, non-navigable, showing the work
 * queued ahead.
 */
function SubplanPlaceholderCard({ name }: { name: string }) {
  return (
    <div
      data-testid={`subplan-placeholder-${name}`}
      className="flex flex-col gap-1 rounded border border-dashed border-gray-200 px-3 py-2"
      title="Declared in the parent's master.md — not created yet"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-gray-400">{name}</span>
        <Badge variant="neutral">queued</Badge>
      </div>
      <span className="text-xs text-gray-400">not created yet</span>
    </div>
  );
}

/** Furthest lifecycle document the plan carries — the card's "stage". */
function planStage(plan: Plan): string {
  if (plan.retrospective) return "retrospective";
  if (plan.impl) return "impl";
  if (plan.adr) return "adr";
  if (plan.testPlan) return "test-plan";
  if (plan.brief) return "brief";
  if (plan.research) return "research";
  return "no documents yet";
}
