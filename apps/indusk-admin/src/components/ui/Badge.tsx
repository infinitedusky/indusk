import type { HTMLAttributes } from "react";

/**
 * Trajectory states from `apps/indusk-mcp/src/lib/trajectory/parser.ts`.
 * The Badge variant set mirrors them so trajectory rows map 1:1.
 */
export type BadgeVariant =
  | "passing"
  | "blocked"
  | "skipped"
  | "planned"
  | "writable"
  | "written"
  | "unknown"
  | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * Color palette per A9 visibility requirement: pass/fail status
 * legible at a glance without reading the State text.
 *
 * - passing: green (success)
 * - blocked: red (attention required)
 * - skipped: muted/yellow (intentional non-test)
 * - planned/writable/written: gray-toned (in flight)
 * - unknown: gray (parser fallback)
 * - neutral: utility variant for non-trajectory uses (status labels, etc.)
 */
const variantClasses: Record<BadgeVariant, string> = {
  passing: "bg-ok-wash text-ok border-ok",
  blocked: "bg-bad-wash text-bad border-bad",
  skipped: "bg-warn-wash text-warn border-warn",
  planned: "bg-idle-wash text-ink-soft border-ink-faint",
  writable: "bg-idle-wash text-ink border-ink-faint",
  written: "bg-dusk-wash text-dusk border-dusk",
  unknown: "bg-ground text-ink-faint border-ink-faint",
  neutral: "bg-idle-wash text-ink-soft border-ink-faint",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const classes = [
    "inline-flex items-center rounded-md px-2 py-hair text-xs font-medium border",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span data-component="chip" className={classes} {...rest}>
      {children}
    </span>
  );
}
