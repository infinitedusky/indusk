import type { HTMLAttributes } from "react";

export interface ExpectationRowProps extends HTMLAttributes<HTMLDivElement> {
  /** The expectation, as the brief states it. */
  text: string;
  /** When to look, as the brief states it. */
  when: string;
  /** Its time to look has come. */
  due?: boolean;
}

/**
 * One expectation on a plan's page: what the brief expects, with the moment to
 * look at it beside it. Due is drawn warm, so the person sees it is theirs.
 */
export function ExpectationRow({
  text,
  when,
  due = false,
  className = "",
  ...rest
}: ExpectationRowProps) {
  return (
    <div
      data-component="expectation-row"
      className={`cols-expectation-row grid items-center gap-4 border-t border-line px-4 py-3 first:border-t-0 ${className}`}
      {...rest}
    >
      <b className="font-medium">{text}</b>
      <span
        className={`font-mono text-xs leading-2 ${due ? "font-semibold text-warn" : "text-ink-faint"}`}
      >
        {when}
      </span>
    </div>
  );
}
