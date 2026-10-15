import {
  planSteps,
  type StepState,
  stepCount,
} from "@infinitedusky/indusk-mcp/plans/steps";
import { Badge } from "@/components/ui/Badge";
import { RailGroup } from "@/components/ui/RailGroup";
import { Step } from "@/components/ui/Step";
import { snapshotOf } from "@/lib/plan-snapshot";
import type { Plan } from "@/lib/planning-reader";

/**
 * The plan page's two workflows: Planning (the documents the plan's type
 * requires) and Release (build to release). Every step's state comes from the
 * package's `plans/steps`; this component only lays them out as the rail's
 * groups and steps. It holds no control — a step is read from the documents,
 * never set here (A12); the rail's `Step` is the approved component's shape
 * and carries no handler.
 *
 * promise: a-plan-shows-two-workflows
 */

/** The words a step's state is told in beside its name. */
const LABEL: Record<StepState, string> = {
  done: "done",
  current: "in progress",
  "needs-you": "needs you",
  "not-yet": "not yet",
  skipped: "skipped",
  missing: "missing",
};

/** How the rail's `Step` draws each state: it has four, so a step the plan will not take reads as waiting. */
const RAIL_STATE: Record<StepState, "done" | "working" | "needs" | "waiting"> =
  {
    done: "done",
    current: "working",
    "needs-you": "needs",
    "not-yet": "waiting",
    skipped: "waiting",
    missing: "waiting",
  };

/** Where each Planning step's document is read: the brief on its own page, the rest as documents. */
const DOCUMENT: Record<string, string> = {
  Research: "doc/research",
  Brief: "brief",
  "Test plan": "doc/test-plan",
  Decision: "doc/adr",
  Impl: "doc/impl",
};

/** A step links to its document once the document exists; the brief always, since its page is where it is written. */
const READABLE: StepState[] = ["done", "current", "needs-you"];

export function PlanWorkflows({
  plan,
  project,
}: {
  plan: Plan;
  /** The project the plan is in; with it, the Planning steps link to their documents. */
  project?: string;
}) {
  const { planning, release } = planSteps(snapshotOf(plan));
  const hrefOf = (step: { name: string; state: StepState }) => {
    const path = DOCUMENT[step.name];
    if (!project || !path) return undefined;
    if (step.name !== "Brief" && !READABLE.includes(step.state))
      return undefined;
    return `/p/${project}/plan/${plan.name}/${path}`;
  };
  return (
    <div className="flex flex-col gap-4" data-testid="plan-workflows">
      <WorkflowList
        which="planning"
        title="Planning"
        steps={planning}
        hrefOf={hrefOf}
      />
      <WorkflowList which="release" title="Release" steps={release} />
    </div>
  );
}

function WorkflowList({
  which,
  title,
  steps,
  hrefOf = () => undefined,
}: {
  which: "planning" | "release";
  title: string;
  steps: Array<{ name: string; state: StepState; reason?: string }>;
  hrefOf?: (step: { name: string; state: StepState }) => string | undefined;
}) {
  const { done, total } = stepCount(steps);
  const now = steps.some(
    (s) => s.state === "current" || s.state === "needs-you",
  );
  return (
    <div data-testid={`workflow-${which}`}>
      <RailGroup
        title={title}
        current={now}
        chip={
          <Badge
            data-testid="workflow-count"
            variant={done === total ? "enforced" : now ? "active" : "declared"}
          >
            {done} of {total}
          </Badge>
        }
      >
        {steps.map((step) => (
          <div
            key={step.name}
            className="contents"
            data-step={step.name}
            data-state={step.state}
          >
            <Step
              name={step.name}
              state={RAIL_STATE[step.state]}
              status={LABEL[step.state]}
              reason={step.reason}
              current={step.state === "current" || step.state === "needs-you"}
              href={hrefOf(step)}
            />
          </div>
        ))}
      </RailGroup>
    </div>
  );
}
