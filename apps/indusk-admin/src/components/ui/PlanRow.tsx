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
  /** Beside the stage, outside the row's link: the worktree mark. */
  worktree?: ReactNode;
}

/**
 * A plan in the nav: its mark, its name and the step it is at, a number first
 * when it sits in a Path. A name too long for the row ends in an ellipsis (the
 * link's title holds it whole). A plan waiting on a person says so in the dusk
 * colour. In a collapsed nav only the mark stays. A row with a worktree is a
 * container whose title is the link, stretched over the whole row, so the mark
 * beside the stage can be a control of its own rather than one inside a link.
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
  worktree,
  className = "",
  ...rest
}: PlanRowProps) {
  const classes = `nav-mark ${
    number === undefined ? "cols-plan-row" : "cols-plan-row-numbered"
  } grid w-full items-center gap-2 rounded-lg border p-tight text-left text-ink ${
    current ? "border-dusk bg-dusk-wash" : "border-transparent"
  } ${className}`;
  const stageClasses = `truncate text-xs leading-2 ${state === "needs" ? "text-dusk" : "text-ink-faint"} ${queued ? "italic" : ""}`;
  const numberCell =
    number === undefined ? null : (
      <span className="nav-hide text-right font-mono text-2xs font-medium leading-1 tabular-nums text-ink-faint">
        {number}
      </span>
    );
  // promise: a-nav-row-keeps-its-parts-apart — the mark is a sibling of the link, never inside it.
  if (worktree != null && worktree !== false) {
    return (
      <div data-component="plan-row" className={`${classes} relative`}>
        {numberCell}
        <PlanBadge state={state}>{initials}</PlanBadge>
        <span className="nav-row-text cols-fill grid min-w-0">
          <ButtonOrLink
            href={href}
            aria-current={current ? "page" : undefined}
            title={name}
            className="nav-row-link min-w-0 after:absolute after:inset-0 after:rounded-lg"
            {...rest}
          >
            <span
              className="nav-hide block truncate text-md font-medium leading-4"
              title={name}
            >
              {name}
            </span>
          </ButtonOrLink>
          <span className="nav-hide flex min-w-0 items-center gap-2">
            <span className={stageClasses}>{stage}</span>
            <span className="relative z-1 flex min-w-0">{worktree}</span>
          </span>
        </span>
      </div>
    );
  }
  return (
    <ButtonOrLink
      href={href}
      data-component="plan-row"
      aria-current={current ? "page" : undefined}
      className={classes}
      {...rest}
    >
      {numberCell}
      <PlanBadge state={state}>{initials}</PlanBadge>
      <span className="nav-hide grid min-w-0">
        <span className="truncate text-md font-medium leading-4" title={name}>
          {name}
        </span>
        <span className={stageClasses}>{stage}</span>
      </span>
    </ButtonOrLink>
  );
}
