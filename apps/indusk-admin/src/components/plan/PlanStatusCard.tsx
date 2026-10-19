import type { PlanDates } from "@infinitedusky/indusk-mcp/promises/display";
import { phaseTitle } from "@/components/bars/labels";
import { activePhaseOf } from "@/components/bars/ProgressLines";
import { DecisionCard } from "@/components/ui/DecisionCard";
import { extractPhases } from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/**
 * What a plan has to say when it waits on no one: a plan being built, with its
 * phases and where it is in them, or a plan that is released. A plan waiting
 * on a person shows `cockpit/DecisionCard` instead; a plan in neither state
 * says nothing here. Presentational over what the plan already holds.
 */

/** The words for a released plan, only what the package read: the release, else the landing. */
function releasedWords(dates?: PlanDates): string {
  if (dates?.released)
    return `Released ${dates.released.version} on ${dates.released.date}. Its promises are watched in use.`;
  if (dates?.landed) return `Merged to main on ${dates.landed}.`;
  return "Closed and archived.";
}

export function PlanStatusCard({
  plan,
  dates,
}: {
  plan: Plan;
  dates?: PlanDates;
}) {
  const said = plan.situation?.situation;
  if (said?.kind === "complete" && !plan.archived) {
    // Merged to main: complete, green, nothing pulsing, with what is still to be confirmed.
    const confirmations = said.confirmations ?? [];
    return (
      <DecisionCard
        who={{ label: "Complete", state: "ok" }}
        title="Complete — merged to main"
      >
        {confirmations.length > 0 ? (
          <ul
            className="grid list-none gap-2 text-md leading-4 text-ink-soft"
            data-testid="plan-confirmations"
          >
            {confirmations.map((c) => (
              <li
                key={c.name}
                className={c.confirmed ? "text-ok" : "text-idle"}
                data-confirmed={c.confirmed}
              >
                {c.confirmed ? "✓" : "○"} {c.name} — {c.kind}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {said.confirmationNote ?? "Everything it promised is confirmed."}
          </p>
        )}
      </DecisionCard>
    );
  }
  if (plan.archived || plan.position?.position === "monitor") {
    return (
      <DecisionCard who={{ label: "Released", state: "ok" }} title="Released">
        <p>{releasedWords(dates)}</p>
      </DecisionCard>
    );
  }
  if (plan.position?.position !== "executing" || !plan.impl) return null;
  const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
  if (phases.length === 0) return null;
  const active = activePhaseOf(plan)?.ref;
  const done = phases.filter((p) => p.activity === "closed").length;
  return (
    <DecisionCard
      who={{ label: "Being built", state: "busy" }}
      title={`Building · ${done} of ${phases.length}`}
    >
      <ul className="grid list-none gap-2 text-md leading-4 text-ink-soft">
        {phases.map((p) => {
          const isActive =
            active?.kind === p.kind && active.number === p.number;
          const [mark, tone] =
            p.activity === "closed"
              ? ["✓", "text-ok"]
              : isActive
                ? ["●", "text-dusk"]
                : ["○", "text-idle"];
          return (
            <li key={`${p.kind}-${p.number}`} className={tone}>
              {mark} {phaseTitle(p)} — {p.title}
            </li>
          );
        })}
      </ul>
    </DecisionCard>
  );
}
