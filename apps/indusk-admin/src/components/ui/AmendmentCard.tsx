import type { HTMLAttributes, ReactNode } from "react";

export interface AmendmentChange {
  name: string;
  /** What was agreed; null when the brief said nothing of it. */
  was: string | null;
  /** What it says now; null when it no longer says it. */
  now: string | null;
}

export interface AmendmentCardProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** What changed, in a few words. */
  title: string;
  changes: AmendmentChange[];
  /** The control that approves it; the card draws none. */
  children?: ReactNode;
}

/**
 * A change made during the build to what the person agreed, held until they
 * approve it: each change as it was and as it is now.
 */
export function AmendmentCard({
  title,
  changes,
  children,
  className = "",
  ...rest
}: AmendmentCardProps) {
  return (
    <section
      data-component="amendment-card"
      className={`grid gap-3 rounded-xl border border-warn bg-warn-wash p-5 ${className}`}
      {...rest}
    >
      <div className="flex items-center gap-2 text-sm leading-3 font-medium text-ink-soft">
        <span className="size-dot-lg rounded-pill bg-warn" />
        The build is waiting for you
      </div>
      <h2 className="font-display text-xl font-bold leading-6">{title}</h2>
      <p className="text-sm leading-3 text-ink-soft">
        The agent changed what was agreed. Approve it, or ask for it back.
      </p>
      {changes.map((c) => (
        <div key={`${c.name}-${c.was}-${c.now}`} className="grid gap-1">
          <p className="font-mono text-xs leading-2 text-ink-faint line-through wrap-anywhere">
            was: {c.was ?? "nothing"}
          </p>
          <p className="font-mono text-xs leading-2 wrap-anywhere">
            now: {c.now ?? "nothing"}
          </p>
        </div>
      ))}
      {children ? <div className="flex">{children}</div> : null}
    </section>
  );
}
