import type { PlanParts as Parts } from "@infinitedusky/indusk-mcp/plans/parts";
import { AmendmentCard } from "@/components/ui/AmendmentCard";
import { ExpectationRow } from "@/components/ui/ExpectationRow";
import { PartSection } from "@/components/ui/PartSection";
import { PhaseRow } from "@/components/ui/PhaseRow";
import type { Phase } from "@/lib/phases";
import {
  documentsSummary,
  expectationsSummary,
  looksSummary,
  type PlanDocument,
  phasesSummary,
  phaseView,
  promisesSummary,
} from "@/lib/plan-parts-view";
import { ApproveAmendments } from "./ApproveAmendments";
import { PlanLook } from "./PlanLook";

/**
 * A plan's page shows the parts of its brief (brief-as-the-contract ADR
 * decision 7): promises, expectations, looks, then phases and documents, each
 * folded to a row of its name and one line until the person opens it. Everything shown is read by the
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

/**
 * The parts of a plan's brief, each folded to a closed row of its name and one
 * line, in the approved order: Promises, Expectations, Looks. The Phases and
 * Documents parts follow, then History, where the page places them.
 */
export function PlanParts({
  parts,
  looksHref,
}: {
  parts: Parts;
  /** The Looks page in the plan's checkout; a look's address is added to it. */
  looksHref: string;
}) {
  if (!parts.hasBrief) return null;
  return (
    <>
      <PartSection
        data-part="promises"
        title="Promises"
        summary={promisesSummary(parts)}
      >
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
      </PartSection>
      <PartSection
        data-part="expectations"
        title="Expectations"
        summary={expectationsSummary(parts)}
      >
        <div className="-mx-4 -my-3">
          {parts.expectations.map((e) => (
            <ExpectationRow
              key={e.text}
              data-testid="plan-expectation"
              text={e.text}
              when={e.look ?? "no time to look given"}
            />
          ))}
        </div>
      </PartSection>
      <PartSection
        data-part="looks"
        title="Looks"
        summary={looksSummary(parts)}
      >
        <div className="-mx-4 -my-3">
          {parts.looks.map((l) => (
            <PlanLook
              key={`${l.relation}-${l.name}`}
              look={l}
              lookHref={`${looksHref}&app=${encodeURIComponent(l.app ?? "")}&mockup=${encodeURIComponent(l.name)}&device=${encodeURIComponent(l.devices[0]?.name ?? "")}`}
            />
          ))}
        </div>
      </PartSection>
    </>
  );
}

/**
 * Phases: each phase a row with its name, items done of total and its state;
 * opened, its items checked or not, each with the note recorded under it.
 */
export function PhasesPart({
  phases,
  activeKey,
}: {
  phases: Phase[];
  activeKey: string | null;
}) {
  if (phases.length === 0) return null;
  return (
    <PartSection
      data-part="phases"
      title="Phases"
      summary={phasesSummary(phases, activeKey)}
    >
      <div className="grid gap-2">
        {phases.map((phase) => {
          const view = phaseView(phase, activeKey);
          return (
            <PhaseRow
              key={view.key}
              data-testid="plan-phase"
              data-phase={view.key}
              name={view.name}
              count={view.count}
              state={view.state}
              tone={view.tone}
            >
              <ul className="grid list-none gap-2">
                {view.items.map((item) => (
                  <li key={item.text} className="flex items-baseline gap-2">
                    <span className="font-mono text-sm leading-3 text-ink-soft">
                      {item.checked ? "☑" : "☐"}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm leading-3">{item.text}</div>
                      {item.note ? (
                        <div className="mt-hair whitespace-pre-line text-xs leading-2 text-ink-faint">
                          {item.note}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </PhaseRow>
          );
        })}
      </div>
    </PartSection>
  );
}

/** Documents: each one the plan has, a row with its name and status that opens its own page. */
export function DocumentsPart({
  documents,
  hrefOf,
}: {
  documents: PlanDocument[];
  hrefOf: (slug: string) => string;
}) {
  if (documents.length === 0) return null;
  return (
    <PartSection
      data-part="documents"
      title="Documents"
      summary={documentsSummary(documents.length)}
    >
      <div className="grid gap-2">
        {documents.map((d) => (
          <PhaseRow
            key={d.slug}
            data-testid="plan-document"
            data-document={d.slug}
            name={d.label}
            state={d.status}
            tone={d.tone}
            href={hrefOf(d.slug)}
          />
        ))}
      </div>
    </PartSection>
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
