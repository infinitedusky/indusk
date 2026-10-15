import type { HTMLAttributes } from "react";

/**
 * A fact about the page's subject in the header: the worktree, the branch, a
 * count. Mono, ringed, never a state — a state is a `Badge`.
 */
export function Tag({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-component="tag"
      className={`whitespace-nowrap rounded-md border border-line bg-surface px-snug py-tight font-mono text-xs font-medium leading-1 text-ink-soft ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
