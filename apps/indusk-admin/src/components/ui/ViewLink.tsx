import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ButtonOrLink } from "./ButtonOrLink";

export interface ViewLinkProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The view's one-letter mark, drawn in the ink square. */
  icon: ReactNode;
  label: string;
  /** What the view is counting — broken promises, uncovered looks; hidden at zero by the caller. */
  count?: ReactNode;
  /** The view that is open. */
  current?: boolean;
  /** Where the view is. A link when given, a button when not. */
  href?: string;
}

/**
 * A view of the project in the nav — Promises, Looks — beside the plans: a
 * mark, a name and the count that wants attention. In a collapsed nav only the
 * mark stays.
 */
export function ViewLink({
  icon,
  label,
  count,
  current = false,
  href,
  className = "",
  ...rest
}: ViewLinkProps) {
  const classes = [
    "nav-mark cols-view-link mt-1 grid w-full items-center gap-2 rounded-lg border p-tight text-left",
    current ? "border-dusk bg-dusk-wash" : "border-transparent",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <ButtonOrLink
      href={href}
      data-component="view-link"
      aria-current={current ? "page" : undefined}
      className={classes}
      {...rest}
    >
      <span className="grid size-badge place-items-center rounded-md bg-ink font-mono text-2xs font-semibold leading-1 text-surface">
        {icon}
      </span>
      <span className="nav-hide text-md font-semibold leading-4">{label}</span>
      {count === undefined ? null : (
        <span className="rounded-pill bg-bad-wash px-tight py-1 nav-hide font-mono text-2xs font-semibold leading-1 text-bad">
          {count}
        </span>
      )}
    </ButtonOrLink>
  );
}
