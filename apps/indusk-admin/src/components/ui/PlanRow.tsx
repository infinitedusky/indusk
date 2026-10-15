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
  /** Its place in a Path, 1-up. Omitted: a row on its own, no number column; empty: a row beside numbered ones, the column kept. */
  number?: ReactNode;
  /** A plan declared but not made yet: its stage is set in italics. */
  queued?: boolean;
  /** The plan that is open. */
  current?: boolean;
  /** Where the row goes. A link when given, a button when not. */
  href?: string;
}

/**
 * A plan in the nav: its mark, its name and the step it is at, a number first
 * when it sits in a Path. A name too long for the row ends in an ellipsis (the
 * link's title holds it whole). A plan waiting on a person says so in the dusk
 * colour. In a collapsed nav only the mark stays.
 */
export function PlanRow({
  initials,
  state,
  name,
  stage,
  number,
  queued = false,
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
      className={`nav-mark ${
        number === undefined ? "cols-plan-row" : "cols-plan-row-numbered"
      } grid w-full items-center gap-2 rounded-lg border p-tight text-left text-ink ${
        current ? "border-dusk bg-dusk-wash" : "border-transparent"
      } ${className}`}
      {...rest}
    >
      {number === undefined ? null : (
        <span className="nav-hide text-right font-mono text-2xs font-medium leading-1 tabular-nums text-ink-faint">
          {number}
        </span>
      )}
      <PlanBadge state={state}>{initials}</PlanBadge>
      <span className="nav-hide grid min-w-0">
        <span className="truncate text-md font-medium leading-4" title={name}>
          {name}
        </span>
        <span
          className={`truncate text-xs leading-2 ${state === "needs" ? "text-dusk" : "text-ink-faint"} ${queued ? "italic" : ""}`}
        >
          {stage}
        </span>
      </span>
    </ButtonOrLink>
  );
}
