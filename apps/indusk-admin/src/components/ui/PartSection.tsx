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
}

/**
 * One part of a plan's page, folded: its name and a one-line summary on a
 * closed row, the part itself when the person opens it. A native disclosure,
 * so it works before any script has run.
 */
export function PartSection({
  title,
  summary,
  children,
  open = false,
  className = "",
  ...rest
}: PartSectionProps) {
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
