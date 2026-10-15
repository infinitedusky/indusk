import Link from "next/link";
import type { ReactNode } from "react";
import { PlanBadge } from "./PlanBadge";

export type SubplanRowState = "released" | "draft" | "queued";

export interface SubplanRowProps {
  /** Its place in the master's order, 1-up. */
  number: number;
  /** The plan's initials, two letters. */
  initials: string;
  state: SubplanRowState;
  /** The plan's title. */
  title: string;
  /** What the plan is for, in a line; empty when its master wrote none. */
  description?: string;
  /** Where the plan stands in words: "Released", "Draft, parked", "Queued". */
  stage: ReactNode;
  /** Where the row goes. A link when given; a plan not made yet has none. */
  href?: string;
}

const STAGE: Record<SubplanRowState, string> = {
  released: "font-medium text-ok",
  draft: "font-medium text-ink-soft",
  queued: "italic text-ink-faint",
};

/**
 * One plan in its master's story: its place, its mark, its title and what it is
 * for, and the stage it is at. Released and draft plans open the plan; a queued
 * plan is dimmed and opens nothing. On a phone the number goes and the stage
 * sits under the title.
 */
export function SubplanRow({
  number,
  initials,
  state,
  title,
  description = "",
  stage,
  href,
}: SubplanRowProps) {
  const queued = state === "queued";
  const className =
    "cols-subplan-row grid items-center gap-3 border-t border-line px-4 py-3 text-ink first:border-t-0";
  const body = (
    <>
      <span className="subplan-row-number text-right font-mono text-2xs font-medium leading-1 tabular-nums text-ink-faint">
        {number}
      </span>
      <PlanBadge state={state === "released" ? "released" : "idle"}>
        {initials}
      </PlanBadge>
      <span className="grid min-w-0 gap-hair">
        <b
          className={`text-md font-medium leading-4 ${queued ? "text-ink-soft" : ""}`}
        >
          {title}
        </b>
        <span
          className={`text-sm leading-3 ${queued ? "text-ink-faint" : "text-ink-soft"}`}
        >
          {description}
        </span>
      </span>
      <span
        className={`subplan-row-stage whitespace-nowrap text-xs leading-2 ${STAGE[state]}`}
      >
        {stage}
      </span>
    </>
  );
  return href === undefined ? (
    <div data-component="subplan-row" data-state={state} className={className}>
      {body}
    </div>
  ) : (
    <Link
      href={href}
      data-component="subplan-row"
      data-state={state}
      className={`${className} no-underline`}
    >
      {body}
    </Link>
  );
}
