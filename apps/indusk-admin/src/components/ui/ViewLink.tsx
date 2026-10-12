import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ViewLinkProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The view's one-letter mark, drawn in the ink square. */
  icon: ReactNode;
  label: string;
  /** What the view is counting — broken promises, uncovered looks; hidden at zero by the caller. */
  count?: number;
  /** The view that is open. */
  current?: boolean;
}

/**
 * A view of the project in the nav — Promises, Looks — beside the plans: a
 * mark, a name and the count that wants attention. In a collapsed nav only the
 * mark stays (`group-data-[collapsed=true]/nav`).
 */
export function ViewLink({
  icon,
  label,
  count,
  current = false,
  className = "",
  ...rest
}: ViewLinkProps) {
  const classes = [
    "mt-1 grid w-full grid-cols-[var(--size-badge)_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-tight text-left",
    "group-data-[collapsed=true]/nav:grid-cols-[var(--size-badge)] group-data-[collapsed=true]/nav:justify-center group-data-[collapsed=true]/nav:px-0",
    current ? "border-dusk bg-dusk-wash" : "border-transparent",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      data-component="view-link"
      aria-current={current ? "page" : undefined}
      className={classes}
      {...rest}
    >
      <span className="grid size-badge place-items-center rounded-md bg-ink text-surface">
        {icon}
      </span>
      <span className="text-md font-semibold leading-4 group-data-[collapsed=true]/nav:hidden">
        {label}
      </span>
      {count === undefined ? null : (
        <span className="rounded-pill bg-bad-wash px-tight py-1 font-mono text-2xs font-semibold leading-1 text-bad group-data-[collapsed=true]/nav:hidden">
          {count}
        </span>
      )}
    </button>
  );
}
