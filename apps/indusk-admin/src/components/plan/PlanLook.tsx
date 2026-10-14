"use client";

import type { PartLook } from "@infinitedusky/indusk-mcp/plans/parts";
import { useState } from "react";
import { LookFrame } from "@/components/looks/LookFrame";
import { LookRow } from "@/components/ui/LookRow";

/**
 * One look on a plan's page: its row (name and approval first) and, one click
 * on, the look itself in the Looks page's frame at the app's reference
 * devices. A look is approved on the Looks page, in the checkout its plan is
 * worked in; this page only shows it, proposed until a person has.
 */
export function PlanLook({
  look,
  lookHref,
}: {
  look: PartLook;
  /** The Looks page at this look, in the plan's checkout. */
  lookHref: string;
}) {
  const [open, setOpen] = useState(false);
  const drawn = look.approval !== "undrawn";
  return (
    <div
      data-testid="plan-look"
      data-look={look.name}
      data-approval={look.approval}
      data-relation={look.relation}
    >
      <LookRow
        kind={look.document || !drawn ? "mockup" : "story"}
        name={look.name}
        approval={look.approval === "undrawn" ? "uncovered" : look.approval}
        onOpen={() => setOpen((was) => !was)}
      />
      {open ? (
        <div className="grid gap-2 border-t border-line px-4 py-3">
          {look.document ? (
            <LookFrame
              title={look.name}
              srcDoc={look.document}
              devices={look.devices}
              initialDevice={look.devices[0]?.name ?? null}
              testId={`plan-look-frame-${look.name}`}
            />
          ) : (
            <p className="text-sm text-ink-faint">
              {drawn
                ? "This look is a story; open it on the Looks page."
                : "Not drawn yet."}
            </p>
          )}
          {drawn ? (
            <a className="text-sm font-medium text-dusk" href={lookHref}>
              {look.approval === "proposed"
                ? "Approve it on the Looks page"
                : "Open on the Looks page"}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
