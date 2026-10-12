import type { HTMLAttributes } from "react";

/**
 * Trajectory states from `apps/indusk-mcp/src/lib/trajectory/parser.ts`.
 * The Badge variant set mirrors them so trajectory rows map 1:1.
 */
export type BadgeVariant =
  // The mockups' chip states (a promise's standing, a look's approval).
  | "declared"
  | "proving"
  | "enforced"
  | "broken"
  | "active"
  // The trajectory's states, which draw the chip's colours.
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
const DECLARED = "bg-idle-wash text-idle";
const PROVING = "bg-warn-wash text-warn";
const ENFORCED = "bg-ok-wash text-ok";
const BROKEN = "bg-bad-wash text-bad";
const ACTIVE = "bg-dusk-wash text-dusk";

const variantClasses: Record<BadgeVariant, string> = {
  declared: DECLARED,
  proving: PROVING,
  enforced: ENFORCED,
  broken: BROKEN,
  active: ACTIVE,
  passing: ENFORCED,
  blocked: BROKEN,
  skipped: PROVING,
  planned: DECLARED,
  writable: DECLARED,
  written: ACTIVE,
  unknown: "bg-ground text-ink-faint",
  neutral: DECLARED,
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const classes = [
    // The mockups' chip: a pill, a dot in the text's colour, small caps.
    "inline-flex items-center gap-tight rounded-pill px-2 py-1 text-2xs leading-1 font-semibold uppercase tracking-chip",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span data-component="chip" className={classes} {...rest}>
      <span aria-hidden="true" className="size-dot rounded-pill bg-current" />
      {children}
    </span>
  );
}
