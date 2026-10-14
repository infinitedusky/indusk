import type { HTMLAttributes } from "react";
import { Badge, type BadgeVariant } from "./Badge";
import { Button } from "./Button";

export type LookApproval = "approved" | "proposed" | "uncovered";

/** What a look is: a mockup is a drawing, a story is the built component. */
export type LookKind = "mockup" | "story";

export interface LookRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether the look is a mockup or a story; every row says. */
  kind: LookKind;
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

/** The kind's label, as the approved `look-row.mockup` / `look-row.story` draw it. */
const KIND: Record<LookKind, { label: string; classes: string }> = {
  mockup: { label: "Mockup", classes: "bg-dusk-wash text-dusk" },
  story: { label: "Story", classes: "bg-idle-wash text-ink-soft" },
};

/**
 * One look on the Looks page: whether it is a mockup or a story, on a line of
 * its own above its name, then whether a person has approved it and how to
 * open it. The name wraps anywhere, so a long one never runs under the chip.
 * A story shows a state; the page that holds the list sends the open.
 *
 * promise: a-look-says-whether-it-is-a-mockup-or-a-story
 */
export function LookRow({
  kind,
  name,
  approval,
  onOpen,
  className = "",
  ...rest
}: LookRowProps) {
  return (
    <div
      data-component="look-row"
      data-state={kind}
      data-look-state={`look-row.${kind}`}
      className={`cols-look-row grid items-center gap-4 border-t border-line px-4 py-3 first:border-t-0 ${className}`}
      {...rest}
    >
      <span className="grid min-w-0 justify-items-start gap-1">
        <span
          className={`rounded-pill px-2 py-1 text-2xs leading-1 font-semibold tracking-caps uppercase ${KIND[kind].classes}`}
        >
          {KIND[kind].label}
        </span>
        <b className="[overflow-wrap:anywhere]">{name}</b>
      </span>
      <Badge variant={CHIP[approval]}>{approval}</Badge>
      <Button size="sm" variant="secondary" onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}
