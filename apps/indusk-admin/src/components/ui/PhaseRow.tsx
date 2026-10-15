import type { HTMLAttributes, ReactNode } from "react";

export type PhaseRowTone = "done" | "doing" | "idle";

export interface PhaseRowProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** What the row is: a phase, a document. */
  name: string;
  /** Items done of total, when the row counts any ("8 of 12"). */
  count?: string;
  /** Where it stands, in words: done ✓, in progress, not started, accepted. */
  state: string;
  tone?: PhaseRowTone;
  /** Opens the row's own page instead of unfolding. */
  href?: string;
  /**
   * The phase's paragraph: what it does for the whole plan, drawn above its
   * items when unfolded. Plain text, or a node the caller formats (the plan
   * page passes the paragraph through markdown; this component imports none).
   */
  summary?: ReactNode;
  /** What the row holds when unfolded. */
  children?: ReactNode;
  /** Drawn open. Closed unless asked. */
  open?: boolean;
}

const TONE: Record<PhaseRowTone, string> = {
  done: "text-ok",
  doing: "text-warn",
  idle: "text-ink-faint",
};

const ROW = "overflow-hidden rounded-lg border border-line bg-ground";
const HEAD = "flex items-baseline gap-3 px-3 py-2 text-left";

/**
 * A row under a part: a phase with its items done of total and its state, or
 * a document with its status. Closed it is one line; unfolded it shows what it
 * holds. Given an `href` it is a link to its own page and does not unfold.
 */
export function PhaseRow({
  name,
  count,
  state,
  tone = "idle",
  href,
  summary,
  children,
  open = false,
  className = "",
  ...rest
}: PhaseRowProps) {
  const head = (
    <>
      <h3 className="font-display text-sm font-bold leading-3">{name}</h3>
      {count ? (
        <span className="font-mono text-xs leading-2 text-ink-faint">
          · {count}
        </span>
      ) : null}
      <span className={`ml-auto font-mono text-xs leading-2 ${TONE[tone]}`}>
        {state}
      </span>
    </>
  );
  if (href) {
    return (
      <a
        data-component="phase-row"
        href={href}
        className={`${ROW} ${HEAD} ${className}`}
        {...(rest as HTMLAttributes<HTMLAnchorElement>)}
      >
        <span aria-hidden="true" className="text-sm leading-3 text-ink-faint">
          ▸
        </span>
        {head}
      </a>
    );
  }
  return (
    <details
      data-component="phase-row"
      open={open}
      className={`group/row ${ROW} ${className}`}
      {...(rest as HTMLAttributes<HTMLDetailsElement>)}
    >
      <summary
        className={`${HEAD} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        <span aria-hidden="true" className="text-sm leading-3 text-ink-faint">
          <span className="group-open/row:hidden">▸</span>
          <span className="hidden group-open/row:inline">▾</span>
        </span>
        {head}
      </summary>
      <div className="border-t border-line p-3">
        {summary ? (
          typeof summary === "string" ? (
            <p className="measure-story mb-3 text-sm leading-3 text-ink-soft">
              {summary}
            </p>
          ) : (
            <div className="measure-story mb-3 text-sm leading-3 text-ink-soft">
              {summary}
            </div>
          )
        ) : null}
        {children}
      </div>
    </details>
  );
}
