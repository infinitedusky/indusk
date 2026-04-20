import type {
  HypothesisEntry,
  HypothesisOutcome,
  LogEntry,
  TerminatorEntry,
} from "@infinitedusky/indusk-mcp/falsification/log";
import { Markdown } from "@/components/Markdown";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { extractPhases } from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

interface PlanDetailProps {
  plan: Plan;
}

/**
 * Main pane for a selected plan. Renders sections conditional on which
 * documents are present:
 *   - Always: header (name + status badge)
 *   - Brief.md: Markdown render of the brief content (Problem + Proposed Direction visible)
 *   - test-plan.md: collapsible Markdown render
 *   - ADR.md: collapsible Markdown render (Goal + Y-statement come through verbatim)
 *   - Impl.md: PhasesSection — one CollapsibleSection per phase containing trajectory rows
 *
 * Missing documents simply don't render their section (T14). Malformed plans
 * surface a banner indicating malformed YAML; the components-that-can-render
 * still render with whatever data they have.
 */
export function PlanDetail({ plan }: PlanDetailProps) {
  return (
    <article
      className="flex flex-col gap-6"
      data-testid="plan-detail"
      data-plan-name={plan.name}
    >
      <PlanHeader plan={plan} />

      {plan.malformed && <MalformedBanner />}

      {plan.malformed && plan.rawDocuments && (
        <RawDocumentsSection rawDocuments={plan.rawDocuments} />
      )}

      {plan.research && (
        <CollapsibleSection title="Research" defaultOpen={!plan.brief}>
          <Markdown>{plan.research.content}</Markdown>
        </CollapsibleSection>
      )}

      {plan.brief && (
        <BriefSection content={plan.brief.content} />
      )}

      {plan.testPlan && (
        <CollapsibleSection title="Test Plan" defaultOpen={false}>
          <Markdown>{plan.testPlan.content}</Markdown>
        </CollapsibleSection>
      )}

      {plan.adr && (
        <CollapsibleSection title="ADR — Goal + Decision" defaultOpen={false}>
          <Markdown>{plan.adr.content}</Markdown>
        </CollapsibleSection>
      )}

      {plan.impl && <PhasesSection plan={plan} />}

      <FalsificationSection plan={plan} />
    </article>
  );
}

function PlanHeader({ plan }: { plan: Plan }) {
  return (
    <header
      className="flex items-center justify-between border-b border-gray-200 pb-3"
      data-testid="plan-header"
    >
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-gray-900">{plan.name}</h1>
        <span className="text-xs text-gray-500">
          {plan.archived ? "archived" : "active"}
        </span>
      </div>
      <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
    </header>
  );
}

function MalformedBanner() {
  return (
    <div
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      data-testid="malformed-banner"
    >
      ⚠ This plan has malformed YAML frontmatter. Some sections may be missing
      or rendered with default values.
    </div>
  );
}

function BriefSection({ content }: { content: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid="brief-section">
      <CollapsibleSection title="Brief" defaultOpen={true}>
        <Markdown>{content}</Markdown>
      </CollapsibleSection>
    </section>
  );
}

function PhasesSection({ plan }: { plan: Plan }) {
  if (!plan.impl) return null;
  const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
  if (phases.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-testid="phases-section">
      <h2 className="text-base font-semibold text-gray-900">Phases</h2>
      <div className="flex flex-col gap-2">
        {phases.map((phase) => (
          <CollapsibleSection
            key={phase.number}
            title={`Phase ${phase.number}${phase.title ? `: ${phase.title}` : ""}`}
            defaultOpen={false}
          >
            <div className="flex flex-col gap-3">
              {phase.trajectoryRows.length > 0 && (
                <div data-testid={`phase-${phase.number}-trajectory`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Asserts</TableHead>
                        <TableHead>Writable at</TableHead>
                        <TableHead>Passes at</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phase.trajectoryRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <span className="font-mono text-xs">{row.id}</span>
                          </TableCell>
                          <TableCell>{row.asserts}</TableCell>
                          <TableCell>Phase {row.writableAt}</TableCell>
                          <TableCell>Phase {row.passesAt}</TableCell>
                          <TableCell>
                            <Badge variant={stateToBadge(row.state)}>{row.state}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <Markdown>{phase.content}</Markdown>
            </div>
          </CollapsibleSection>
        ))}
      </div>
    </section>
  );
}

function RawDocumentsSection({
  rawDocuments,
}: {
  rawDocuments: Record<string, string>;
}) {
  const entries = Object.entries(rawDocuments);
  if (entries.length === 0) return null;
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="raw-documents-section"
    >
      <h2 className="text-base font-semibold text-gray-900">
        Raw documents (malformed frontmatter)
      </h2>
      <p className="text-xs text-gray-500">
        These files couldn't be parsed. Showing the raw markdown so you can
        diagnose. Fix the YAML frontmatter and refresh.
      </p>
      <div className="flex flex-col gap-2">
        {entries.map(([filename, raw]) => (
          <CollapsibleSection
            key={filename}
            title={filename}
            defaultOpen={false}
          >
            <pre
              className="overflow-x-auto rounded bg-gray-50 p-3 text-xs font-mono text-gray-800 whitespace-pre-wrap"
              data-testid={`raw-${filename}`}
            >
              {raw}
            </pre>
          </CollapsibleSection>
        ))}
      </div>
    </section>
  );
}

function FalsificationSection({ plan }: { plan: Plan }) {
  if (!plan.falsification) {
    return (
      <section
        className="flex flex-col gap-2"
        data-testid="falsification-section"
      >
        <h2 className="text-base font-semibold text-gray-900">Falsification</h2>
        <p className="text-sm text-gray-500" data-testid="falsification-empty">
          No falsification ritual run for this plan.
        </p>
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
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Falsification</h2>
        <Badge variant={plan.falsification.complete ? "passing" : "writable"}>
          {plan.falsification.complete ? "complete" : "in-progress"}
        </Badge>
      </header>
      {hypotheses.length === 0 && (
        <p className="text-sm text-gray-500">
          No hypotheses logged yet.
        </p>
      )}
      {hypotheses.length > 0 && (
        <ul className="flex flex-col gap-3" data-testid="falsification-hypotheses">
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
          <span className="font-semibold">Terminated:</span> {terminator.reason}
        </div>
      )}
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
      {entry.note && (
        <p className="text-xs text-gray-500">{entry.note}</p>
      )}
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

function statusToBadge(status: string): BadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized.includes("completed") || normalized.includes("passing")) return "passing";
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("in-progress") || normalized.includes("accepted")) return "writable";
  if (normalized.includes("draft") || normalized.includes("planned")) return "planned";
  return "neutral";
}

function stateToBadge(state: string): BadgeVariant {
  const normalized = state.toLowerCase();
  if (["passing", "blocked", "skipped", "planned", "writable", "written"].includes(normalized)) {
    return normalized as BadgeVariant;
  }
  return "neutral";
}
