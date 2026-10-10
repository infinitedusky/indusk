import {
  planSteps,
  type StepState,
  stepCount,
} from "@infinitedusky/indusk-mcp/plans/steps";
import type { Plan } from "@/lib/planning-reader";
import { snapshotOf } from "@/lib/plan-snapshot";

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
  done: "text-green-700",
  current: "font-medium text-blue-700",
  "needs-you": "font-medium text-amber-700",
  "not-yet": "text-gray-400",
  skipped: "text-gray-400 line-through",
  missing: "text-red-700",
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
      className="rounded-md border border-gray-200 p-3"
      data-testid={`workflow-${which}`}
    >
      <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-gray-900">
        {title}
        <span
          className="text-xs font-normal text-gray-500"
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
            <span className="text-xs text-gray-500">
              {LABEL[step.state]}
              {step.reason ? ` — ${step.reason}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
