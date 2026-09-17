import type {
  HypothesisEntry,
  HypothesisOutcome,
  LogEntry,
  TerminatorEntry,
} from "@infinitedusky/indusk-mcp/falsification/log";
import { RitualPhaseSection } from "@/components/phases/RitualPhaseSection";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { falsificationLogMarkdown } from "@/lib/markdown-export";
import type { Phase } from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/**
 * Falsification rendering for a plan detail page. Extracted from
 * PlanDetail.tsx (dawn-ui-plan-grouping cleanup) — the section, its
 * phase-authoring variant, and their helpers are one self-contained unit.
 *
 * Priority: phase-authoring flow (new, 1.27.4+) > legacy log file > empty
 * state.
 */
export function FalsificationSection({
  plan,
  phase,
}: {
  plan: Plan;
  phase: Phase | null;
}) {
  // Priority: phase-authoring flow (new, 1.27.4+) > legacy log file > empty state.
  if (phase) {
    return (
      <RitualPhaseSection
        ritual="falsification"
        planName={plan.name}
        phase={phase}
      />
    );
  }
  if (!plan.falsification) {
    return (
      <section
        className="flex flex-col gap-2"
        data-testid="falsification-section"
      >
        <CollapsibleSection
          title="Falsification"
          defaultOpen={false}
          persistKey={`plan:${plan.name}:section:falsification`}
          copyMarkdown={falsificationLogMarkdown(undefined)}
        >
          <p
            className="text-sm text-gray-500"
            data-testid="falsification-empty"
          >
            No falsification ritual run for this plan.
          </p>
        </CollapsibleSection>
      </section>
    );
  }

  const hypotheses = plan.falsification.entries.filter(isHypothesis);
  const terminator = plan.falsification.entries.find(isTerminator);

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="falsification-section"
    >
      <CollapsibleSection
        title="Falsification"
        defaultOpen={false}
        persistKey={`plan:${plan.name}:section:falsification`}
        headerRight={
          <Badge variant={plan.falsification.complete ? "passing" : "writable"}>
            {plan.falsification.complete ? "complete" : "in-progress"}
          </Badge>
        }
        copyMarkdown={falsificationLogMarkdown(plan.falsification)}
      >
        <div className="flex flex-col gap-2">
          {hypotheses.length === 0 && (
            <p className="text-sm text-gray-500">No hypotheses logged yet.</p>
          )}
          {hypotheses.length > 0 && (
            <ul
              className="flex flex-col gap-3"
              data-testid="falsification-hypotheses"
            >
              {hypotheses.map((entry) => (
                <HypothesisItem
                  key={`${entry.timestamp}-${entry.hypothesis.slice(0, 32)}`}
                  entry={entry}
                />
              ))}
            </ul>
          )}
          {terminator && (
            <div
              className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              data-testid="falsification-terminator"
            >
              <span className="font-semibold">Terminated:</span>{" "}
              {terminator.reason}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </section>
  );
}

function HypothesisItem({ entry }: { entry: HypothesisEntry }) {
  return (
    <li
      className="flex flex-col gap-1 rounded border border-gray-200 px-3 py-2"
      data-testid={`hypothesis-${entry.outcome}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">Hypothesis</span>
        <Badge variant={outcomeToBadge(entry.outcome)}>{entry.outcome}</Badge>
      </div>
      <p className="text-sm text-gray-700">{entry.hypothesis}</p>
      {entry.testPath && (
        <p className="text-xs text-gray-500 font-mono">{entry.testPath}</p>
      )}
      {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
    </li>
  );
}

function isHypothesis(entry: LogEntry): entry is HypothesisEntry {
  return entry.kind === "hypothesis";
}

function isTerminator(entry: LogEntry): entry is TerminatorEntry {
  return entry.kind === "terminator";
}

function outcomeToBadge(outcome: HypothesisOutcome): BadgeVariant {
  if (outcome === "fix-in-scope") return "passing";
  if (outcome === "spawn-plan") return "writable";
  return "neutral"; // accept-finding
}
