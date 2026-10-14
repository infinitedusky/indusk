import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";

export interface CreatingStep {
  label: string;
  state: "done" | "working" | "waiting" | "failed";
}

const DOT: Record<CreatingStep["state"], string> = {
  done: "bg-ok",
  working: "bg-dusk",
  waiting: "bg-idle",
  failed: "bg-bad",
};

/**
 * The creation of a project (new-project-flow, the approved
 * `new-project.creating`): the project's name, each step with a dot that says
 * where it stands, where it is being made, and - once there is a project - the
 * way into it. Before then the way in is there but cannot be used, so the
 * page does not move when it arrives. A step that failed says why, and
 * `actions` offers what can be done about it.
 *
 * It draws what it is given: the steps are the package's, carried here by the
 * page that streams them.
 *
 * promise: a-new-project-is-made-by-the-agent
 */
export function NewProjectCreating({
  steps,
  name,
  location,
  href,
  problem = null,
  actions,
}: {
  steps: readonly CreatingStep[];
  name?: string;
  location?: string;
  /** Where the finished project is read; absent until it exists. */
  href?: string;
  problem?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="grid gap-5" data-look-state="new-project.creating">
      <header>
        <div className="text-sm leading-3 text-ink-faint">
          <b className="font-medium text-ink-soft">Projects</b> / New
        </div>
        <h1 className="font-display text-4xl leading-7 font-bold">
          {name ?? "New project"}
        </h1>
        <p className="text-sm leading-3 text-ink-faint">
          {problem
            ? "Creating your project stopped."
            : "Creating your project."}
        </p>
      </header>
      <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
        <ul className="grid gap-2">
          {steps.map((step) => (
            <li
              key={step.label}
              className={`flex items-center gap-3 text-sm leading-3 ${
                step.state === "waiting" ? "text-ink-faint" : ""
              }`}
            >
              <span
                className={`size-dot flex-none rounded-pill ${DOT[step.state]}`}
              />
              <span>{step.label}</span>
            </li>
          ))}
        </ul>
        {location ? (
          <p className="font-mono text-xs leading-2 break-words text-ink-faint">
            {location}
          </p>
        ) : null}
        {problem ? (
          <p className="text-sm leading-3 whitespace-pre-wrap text-bad">
            {problem}
          </p>
        ) : null}
      </section>
      <div className="flex flex-wrap items-center gap-3">
        {href ? (
          <Link href={href} className={buttonClasses("primary")}>
            Open the project
          </Link>
        ) : problem ? null : (
          <Button variant="secondary" disabled>
            Open the project when it's ready
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
