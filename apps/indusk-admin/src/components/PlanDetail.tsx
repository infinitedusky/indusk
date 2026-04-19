import type { Plan } from "@/lib/planning-reader";
import { extractPhases } from "@/lib/phases";
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
import { Markdown } from "@/components/Markdown";

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
      <h2 className="text-base font-semibold text-gray-900">Brief</h2>
      <Markdown>{content}</Markdown>
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
