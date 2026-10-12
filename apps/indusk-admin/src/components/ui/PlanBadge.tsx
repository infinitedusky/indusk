import type { HTMLAttributes } from "react";

export type PlanBadgeState = "needs" | "working" | "released";

export interface PlanBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** What the plan is doing: waiting on a person, being built, shipped. */
  state: PlanBadgeState;
  /** The plan's initials, two letters. */
  children: string;
}

const DOT: Record<PlanBadgeState, string> = {
  needs: "after:bg-dusk",
  working: "pulse-slow after:bg-ink-soft",
  released: "after:bg-ok",
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
      className={`relative grid size-badge place-items-center rounded-md border border-line bg-ground font-mono text-2xs font-medium leading-1 text-ink-soft after:absolute after:-right-1 after:-top-1 after:size-node after:rounded-pill after:border-2 after:border-surface after:content-[''] ${DOT[state]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
