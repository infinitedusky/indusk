import type { ButtonHTMLAttributes } from "react";
import { PlanBadge, type PlanBadgeState } from "./PlanBadge";

export interface PlanRowProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  initials: string;
  state: PlanBadgeState;
  name: string;
  /** Where the plan stands in words: "Approve the cockpit mockups", "Building · 2 of 5". */
  stage: string;
  /** The plan that is open. */
  current?: boolean;
}

/**
 * A plan in the nav: its mark, its name and the step it is at. A plan waiting
 * on a person says so in the dusk colour. In a collapsed nav only the mark
 * stays.
 */
export function PlanRow({
  initials,
  state,
  name,
  stage,
  current = false,
  className = "",
  ...rest
}: PlanRowProps) {
  return (
    <button
      type="button"
      data-component="plan-row"
      aria-current={current ? "page" : undefined}
      className={`grid w-full grid-cols-[var(--size-badge)_minmax(0,1fr)] items-center gap-2 rounded-lg border p-tight text-left group-data-[collapsed=true]/nav:grid-cols-[var(--size-badge)] group-data-[collapsed=true]/nav:justify-center group-data-[collapsed=true]/nav:px-0 ${
        current ? "border-dusk bg-dusk-wash" : "border-transparent"
      } ${className}`}
      {...rest}
    >
      <PlanBadge state={state}>{initials}</PlanBadge>
      <span className="grid min-w-0 group-data-[collapsed=true]/nav:hidden">
        <span className="text-md font-medium leading-4 [overflow-wrap:anywhere]">
          {name}
        </span>
        <span
          className={`text-xs leading-2 ${state === "needs" ? "text-dusk" : "text-ink-faint"}`}
        >
          {stage}
        </span>
      </span>
    </button>
  );
}
