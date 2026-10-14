import type { HTMLAttributes, ReactNode } from "react";

export interface PartSectionProps
  extends Omit<HTMLAttributes<HTMLDetailsElement>, "title"> {
  /** The part's name. */
  title: string;
  /** The one line it says when closed: counts, the current phase. */
  summary: string;
  /** What it holds when opened. */
  children?: ReactNode;
  /** Drawn open. Closed unless asked. */
  open?: boolean;
  /** Holds nothing: a plain row of its name and summary, not a disclosure — there is nothing to open. */
  empty?: boolean;
}

/**
 * One part of a plan's page, folded: its name and a one-line summary on a
 * closed row, the part itself when the person opens it. A native disclosure,
 * so it works before any script has run. A part with nothing in it is only the
 * row: no arrow, nothing to open.
 */
export function PartSection({
  title,
  summary,
  children,
  open = false,
  empty = false,
  className = "",
  ...rest
}: PartSectionProps) {
  if (empty) {
    return (
      <div
        data-component="part-section"
        data-empty="true"
        className={`flex items-baseline gap-3 overflow-hidden rounded-xl border border-line bg-surface px-4 py-3 ${className}`}
      >
        {/* where the arrow would be, so the title lines up with its siblings' */}
        <span aria-hidden="true" className="size-dot" />
        <h2 className="font-display text-base font-bold leading-5">{title}</h2>
        <span className="font-mono text-xs leading-2 text-ink-faint">
          · {summary}
        </span>
      </div>
    );
  }
  return (
    <details
      data-component="part-section"
      open={open}
      className={`group/part overflow-hidden rounded-xl border border-line bg-surface ${className}`}
      {...rest}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-sm leading-3 text-ink-faint">
          <span className="group-open/part:hidden">▸</span>
          <span className="hidden group-open/part:inline">▾</span>
        </span>
        <h2 className="font-display text-base font-bold leading-5">{title}</h2>
        <span className="font-mono text-xs leading-2 text-ink-faint">
          · {summary}
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}
