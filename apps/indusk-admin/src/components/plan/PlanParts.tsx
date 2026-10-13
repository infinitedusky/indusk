import type { PlanParts as Parts } from "@infinitedusky/indusk-mcp/plans/parts";
import { AmendmentCard } from "@/components/ui/AmendmentCard";
import { ExpectationRow } from "@/components/ui/ExpectationRow";
import { ApproveAmendments } from "./ApproveAmendments";
import { PlanLook } from "./PlanLook";

/**
 * A plan's page shows the three parts of its brief (brief-as-the-contract
 * ADR decision 7): promises, expectations and looks, each with its name and
 * state first and the brief one link below. Everything shown is read by the
 * package's `plans/parts`; nothing is worked out here
 * (`cockpit-single-definition.test.ts`).
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 * promise: a-look-has-the-plan-that-owns-it
 */

/** A promise's state as the dot beside its name. */
const DOT: Record<string, string> = {
  enforced: "bg-ok",
  "known-violated": "bg-bad",
  declared: "bg-idle",
  retired: "bg-idle",
  unregistered: "bg-idle",
};

function PartHead({ title, state }: { title: string; state: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <h2 className="font-display text-lg font-bold leading-4">{title}</h2>
      <span className="font-mono text-xs leading-2 text-ink-faint">
        {state}
      </span>
    </div>
  );
}

export function PlanParts({
  parts,
  briefHref,
  looksHref,
}: {
  parts: Parts;
  briefHref: string;
  /** The Looks page in the plan's checkout; a look's address is added to it. */
  looksHref: string;
}) {
  if (!parts.hasBrief) return null;
  const enforced = parts.promises.filter((p) => p.state === "enforced").length;
  const approved = parts.looks.filter((l) => l.approval === "approved").length;
  return (
    <section className="grid gap-5" data-testid="plan-parts">
      <div className="grid gap-snug" data-part="promises">
        <PartHead
          title="Promises"
          state={`${enforced} of ${parts.promises.length} enforced`}
        />
        <div className="flex flex-wrap gap-2">
          {parts.promises.map((p) => (
            <span
              key={p.name}
              data-testid="plan-promise"
              data-promise={p.name}
              data-state={p.state}
              title={p.sentence}
              className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-snug text-sm leading-3 font-medium"
            >
              <span
                className={`size-dot rounded-pill ${DOT[p.state] ?? "bg-idle"}`}
              />
              {p.name}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-snug" data-part="expectations">
        <PartHead
          title="Expectations"
          state={
            parts.expectations.length === 0
              ? "none"
              : `${parts.expectations.length} to look at`
          }
        />
        {parts.expectations.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {parts.expectations.map((e) => (
              <ExpectationRow
                key={e.text}
                data-testid="plan-expectation"
                text={e.text}
                when={e.look ?? "no time to look given"}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid gap-snug" data-part="looks">
        <PartHead
          title="Looks"
          state={
            parts.looks.length === 0
              ? (parts.noLooks ?? "none listed")
              : `${approved} of ${parts.looks.length} approved`
          }
        />
        {parts.looks.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {parts.looks.map((l) => (
              <PlanLook
                key={`${l.relation}-${l.name}`}
                look={l}
                lookHref={`${looksHref}&app=${encodeURIComponent(l.app ?? "")}&mockup=${encodeURIComponent(l.name)}&device=${encodeURIComponent(l.devices[0]?.name ?? "")}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <a
        className="justify-self-start text-sm leading-3 font-medium text-dusk"
        data-testid="plan-brief-link"
        href={briefHref}
      >
        Read the brief
      </a>
    </section>
  );
}

/**
 * The amendments a plan waits on, above the decision the plan waits at: each
 * as it was and as it is, with Approve. Absent when none waits.
 */
export function WaitingAmendments({
  project,
  plan,
  parts,
}: {
  project: string;
  plan: string;
  parts: Parts;
}) {
  if (parts.amendments.length === 0) return null;
  return (
    <div data-testid="waiting-amendments">
      <AmendmentCard
        title={
          parts.amendments.length === 1
            ? `A ${parts.amendments[0]?.part} changed during the build`
            : `${parts.amendments.length} things agreed changed during the build`
        }
        changes={parts.amendments}
      >
        <ApproveAmendments project={project} plan={plan} />
      </AmendmentCard>
    </div>
  );
}
