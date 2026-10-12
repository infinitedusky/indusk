import {
  planSteps,
  type StepState,
  stepCount,
} from "@infinitedusky/indusk-mcp/plans/steps";
import { snapshotOf } from "@/lib/plan-snapshot";
import type { Plan } from "@/lib/planning-reader";

/**
 * The plan page's two workflows: Planning (the documents the plan's type
 * requires) and Release (build to release). Every step's state comes from the
 * package's `plans/steps`; this component only lays them out. It holds no
 * control — a step is read from the documents, never set here (A12).
 *
 * promise: a-plan-shows-two-workflows
 */

const MARK: Record<StepState, string> = {
  done: "✓",
  current: "●",
  "needs-you": "!",
  "not-yet": "○",
  skipped: "–",
  missing: "?",
};

const STYLE: Record<StepState, string> = {
  done: "text-ok",
  current: "font-medium text-dusk",
  "needs-you": "font-medium text-warn",
  "not-yet": "text-ink-faint",
  skipped: "text-ink-faint line-through",
  missing: "text-bad",
};

const LABEL: Record<StepState, string> = {
  done: "done",
  current: "in progress",
  "needs-you": "needs you",
  "not-yet": "not yet",
  skipped: "skipped",
  missing: "missing",
};

export function PlanWorkflows({ plan }: { plan: Plan }) {
  const { planning, release } = planSteps(snapshotOf(plan));
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      data-testid="plan-workflows"
    >
      <WorkflowList which="planning" title="Planning" steps={planning} />
      <WorkflowList which="release" title="Release" steps={release} />
    </div>
  );
}

function WorkflowList({
  which,
  title,
  steps,
}: {
  which: "planning" | "release";
  title: string;
  steps: Array<{ name: string; state: StepState; reason?: string }>;
}) {
  const { done, total } = stepCount(steps);
  return (
    <section
      className="rounded-md border border-line p-3"
      data-testid={`workflow-${which}`}
    >
      <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-ink">
        {title}
        <span
          className="text-xs font-regular text-ink-faint"
          data-testid="workflow-count"
        >
          {done} of {total}
        </span>
      </h2>
      <ol className="flex flex-col gap-1">
        {steps.map((step) => (
          <li
            key={step.name}
            data-step={step.name}
            data-state={step.state}
            className={`flex items-center gap-2 text-sm ${STYLE[step.state]}`}
          >
            <span aria-hidden="true" className="w-4 text-center">
              {MARK[step.state]}
            </span>
            <span>{step.name}</span>
            <span className="text-xs text-ink-faint">
              {LABEL[step.state]}
              {step.reason ? ` — ${step.reason}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
