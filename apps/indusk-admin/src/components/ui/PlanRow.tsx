import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ButtonOrLink } from "./ButtonOrLink";
import { PlanBadge, type PlanBadgeState } from "./PlanBadge";

export interface PlanRowProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  initials: string;
  state: PlanBadgeState;
  name: string;
  /** Where the plan stands in words: "Approve the cockpit mockups", "Building · 2 of 5". */
  stage: ReactNode;
  /** The plan that is open. */
  current?: boolean;
  /** Where the row goes. A link when given, a button when not. */
  href?: string;
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
  href,
  className = "",
  ...rest
}: PlanRowProps) {
  return (
    <ButtonOrLink
      href={href}
      data-component="plan-row"
      aria-current={current ? "page" : undefined}
      className={`nav-mark cols-plan-row grid w-full items-center gap-2 rounded-lg border p-tight text-left ${
        current ? "border-dusk bg-dusk-wash" : "border-transparent"
      } ${className}`}
      {...rest}
    >
      <PlanBadge state={state}>{initials}</PlanBadge>
      <span className="nav-hide grid min-w-0">
        <span className="text-md font-medium leading-4 wrap-anywhere">
          {name}
        </span>
        <span
          className={`text-xs leading-2 ${state === "needs" ? "text-dusk" : "text-ink-faint"}`}
        >
          {stage}
        </span>
      </span>
    </ButtonOrLink>
  );
}
