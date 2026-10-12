import type { ButtonHTMLAttributes } from "react";

export type StepState = "done" | "working" | "needs" | "waiting";

export interface StepProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  name: string;
  /** In words: "done", "approved", "waiting for you". */
  status: string;
  state: StepState;
  /** The step the page is on. */
  current?: boolean;
}

const NODE: Record<StepState, string> = {
  done: "border-ok bg-ok",
  working: "pulse border-dusk bg-dusk",
  needs: "halo border-dusk bg-surface",
  waiting: "border-idle bg-surface",
};

const STATUS: Record<StepState, string> = {
  done: "text-ok",
  working: "text-dusk",
  needs: "text-dusk",
  waiting: "text-ink-faint",
};

/**
 * One step of a plan's lifecycle in its rail: a node that says where it
 * stands, its name, and the words for its status. A step waiting on a person
 * is the one that stands out.
 */
export function Step({
  name,
  status,
  state,
  current = false,
  className = "",
  ...rest
}: StepProps) {
  return (
    <button
      type="button"
      data-component="step"
      data-state={state}
      aria-current={current ? "step" : undefined}
      className={`cols-step grid w-full items-center gap-snug rounded-lg border px-tight py-2 text-left ${
        current ? "border-ink-faint bg-ground" : "border-transparent"
      } ${className}`}
      {...rest}
    >
      <span className={`ml-1 size-node rounded-pill border-2 ${NODE[state]}`} />
      <span
        className={`text-md leading-4 ${state === "needs" ? "font-semibold" : "font-medium"} ${state === "waiting" ? "text-ink-faint" : ""}`}
      >
        {name}
      </span>
      <span
        className={`whitespace-nowrap font-mono text-2xs font-medium leading-1 ${STATUS[state]}`}
      >
        {status}
      </span>
    </button>
  );
}
