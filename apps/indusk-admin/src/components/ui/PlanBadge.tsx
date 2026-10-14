import type { HTMLAttributes } from "react";

export type PlanBadgeState = "needs" | "working" | "released" | "idle";

export interface PlanBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** What the plan is doing: waiting on a person, being built, shipped, or a draft nobody is working. */
  state: PlanBadgeState;
  /** The plan's initials, two letters. */
  children: string;
}

const DOT: Record<PlanBadgeState, string> = {
  needs: "bg-dusk",
  working: "pulse-slow bg-ink-soft",
  released: "bg-ok",
  idle: "bg-idle",
};

/**
 * A plan's mark in the nav: its initials in a square, with a dot at the corner
 * for where the plan stands. (The mockups' `chip` is the pill — `Badge`.)
 */
export function PlanBadge({
  state,
  children,
  className = "",
  ...rest
}: PlanBadgeProps) {
  return (
    <span
      data-component="badge"
      data-state={state}
      className={`relative grid size-badge place-items-center rounded-md border border-line bg-ground font-mono text-2xs font-medium leading-1 text-ink-soft ${className}`}
      {...rest}
    >
      {children}
      <span
        aria-hidden="true"
        className={`absolute -right-1 -top-1 size-node rounded-pill border-2 border-surface ${DOT[state]}`}
      />
    </span>
  );
}
