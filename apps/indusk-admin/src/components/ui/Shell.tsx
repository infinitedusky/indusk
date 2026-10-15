import type { HTMLAttributes, ReactNode } from "react";

export interface ShellProps extends HTMLAttributes<HTMLDivElement> {
  /** The nav folded to its rail: the first column is the rail's width. */
  collapsed?: boolean;
  /** The nav and the page. */
  children: ReactNode;
}

/**
 * The frame every screen sits in: the nav's column and the page beside it. On
 * a phone the nav is a drawer and takes no column. The nav inside carries its
 * own collapsed state (`Nav`'s `collapsed`), which this frame mirrors in the
 * width it gives the first column.
 */
export function Shell({
  collapsed = false,
  className = "",
  children,
  ...rest
}: ShellProps) {
  const classes = [
    "grid min-h-screen",
    collapsed ? "cols-shell-rail" : "cols-shell",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      data-component="shell"
      data-collapsed={collapsed ? "true" : "false"}
      className={classes}
      {...rest}
    >
      {children}
    </div>
  );
}
