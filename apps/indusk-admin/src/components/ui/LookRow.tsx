import type { HTMLAttributes } from "react";
import { Badge, type BadgeVariant } from "./Badge";
import { Button } from "./Button";

export type LookApproval = "approved" | "proposed" | "uncovered";

export interface LookRowProps extends HTMLAttributes<HTMLDivElement> {
  /** The look: `dashboard.default`, `promise.broken`. */
  name: string;
  approval: LookApproval;
  onOpen?: () => void;
}

/** A look's approval drawn as the chip the mockups use for it. */
const CHIP: Record<LookApproval, BadgeVariant> = {
  approved: "enforced",
  proposed: "proving",
  uncovered: "declared",
};

/**
 * One look on the Looks page: its name, whether a person has approved it, and
 * how to open it. A story shows a state; the page that holds the list sends
 * the open.
 */
export function LookRow({
  name,
  approval,
  onOpen,
  className = "",
  ...rest
}: LookRowProps) {
  return (
    <div
      data-component="look-row"
      className={`cols-look-row grid items-center gap-4 border-t border-line px-4 py-3 first:border-t-0 ${className}`}
      {...rest}
    >
      <span>
        <b>{name}</b>
      </span>
      <Badge variant={CHIP[approval]}>{approval}</Badge>
      <Button size="sm" variant="secondary" onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}
