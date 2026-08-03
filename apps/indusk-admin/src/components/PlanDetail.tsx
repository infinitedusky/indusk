import { FalsificationSection } from "@/components/FalsificationSection";
import { Markdown } from "@/components/Markdown";
import { ParentPlanView, type SubplanEntry } from "@/components/ParentPlanView";
import { Badge } from "@/components/ui/Badge";
import { stateToBadge, statusToBadge } from "@/components/ui/badge-variant";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  phaseMarkdown,
  planMarkdown,
  sectionMarkdown,
} from "@/lib/markdown-export";
import {
  extractPhases,
  type Phase,
  splitPhasesAroundFalsification,
} from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

interface PlanDetailProps {
  plan: Plan;
  /**
   * Declared subplans when this plan is a parent (its master.md names
   * `subplans:`). Non-empty → the detail view renders master prose + a card
   * per subplan first, then whatever standard document sections the plan
   * actually carries — additive, never suppressing (T12). A typical parent
   * carries only master.md/maxims.md (outside DOC_FILES), so usually the
   * cards stand alone.
   */
  subplans?: SubplanEntry[];
  /** The parent's own master.md prose, rendered above the cards. */
  masterContent?: string;
  /** Route prefix for subplan card links — same convention as PlanList. */
  planHrefPrefix?: string;
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
export function PlanDetail({
  plan,
  subplans,
  masterContent,
  planHrefPrefix = "/plan/",
}: PlanDetailProps) {
  const isParent = subplans !== undefined && subplans.length > 0;
  // A plan with no documents at all (a parent whose declarations are missing
  // or corrupt, a bare folder) renders header-only — an empty Falsification
  // section on a doc-less plan is noise, not information.
  const hasAnyDocument =
    plan.research !== undefined ||
    plan.brief !== undefined ||
    plan.testPlan !== undefined ||
    plan.adr !== undefined ||
    plan.impl !== undefined ||
    plan.falsification !== undefined ||
    plan.retrospective !== undefined;
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

      {isParent && subplans && (
        <ParentPlanView
          subplans={subplans}
          masterContent={masterContent}
          prefix={planHrefPrefix}
        />
      )}

      {plan.research && (
        <CollapsibleSection
          title="Research"
          defaultOpen={!plan.brief}
          persistKey={`plan:${plan.name}:section:research`}
          copyMarkdown={sectionMarkdown("Research", plan.research.content)}
        >
          <Markdown>{plan.research.content}</Markdown>
        </CollapsibleSection>
      )}

      {plan.brief && (
        <BriefSection planName={plan.name} content={plan.brief.content} />
      )}

      {plan.testPlan && (
        <CollapsibleSection
          title="Test Plan"
          defaultOpen={false}
          persistKey={`plan:${plan.name}:section:test-plan`}
          copyMarkdown={sectionMarkdown("Test Plan", plan.testPlan.content)}
        >
          <Markdown>{plan.testPlan.content}</Markdown>
        </CollapsibleSection>
      )}

      {plan.adr && (
        <CollapsibleSection
          title="ADR — Goal + Decision"
          defaultOpen={false}
          persistKey={`plan:${plan.name}:section:adr`}
          copyMarkdown={sectionMarkdown(
            "ADR — Goal + Decision",
            plan.adr.content,
          )}
        >
          <Markdown>{plan.adr.content}</Markdown>
        </CollapsibleSection>
      )}

      {plan.impl && <ImplSections plan={plan} />}
      {!plan.impl && hasAnyDocument && (
        <FalsificationSection plan={plan} phase={null} />
      )}
    </article>
  );
}

/**
 * When an impl.md exists, split its phases into pre-falsification / falsification
 * / post-falsification groups and render each in its own section. The
 * falsification phase (if any) is rendered by `FalsificationSection` instead of
 * mixed into the main Phases section. Post-falsification phases render below as
 * "Follow-up Phases" — the fix-in-scope derivatives of the ritual.
 *
 * When no impl is present, the PlanDetail top-level still shows a
 * FalsificationSection directly (legacy-log-only path).
 */
function ImplSections({ plan }: { plan: Plan }) {
  if (!plan.impl) return null;
  const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
  const split = splitPhasesAroundFalsification(phases);
  return (
    <>
      {split.pre.length > 0 && (
        <PhasesSection
          phases={split.pre}
          heading="Phases"
          testId="phases-section"
          planName={plan.name}
        />
      )}
      <FalsificationSection plan={plan} phase={split.falsification} />
      {split.post.length > 0 && (
        <PhasesSection
          phases={split.post}
          heading="Follow-up Phases"
          testId="followup-phases-section"
          planName={plan.name}
        />
      )}
    </>
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
      <div className="flex items-center gap-3">
        <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
        <CopyButton
          text={planMarkdown(plan)}
          label="Copy whole plan as markdown"
          data-testid="copy-plan-button"
        />
      </div>
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

function BriefSection({
  planName,
  content,
}: {
  planName: string;
  content: string;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid="brief-section">
      <CollapsibleSection
        title="Brief"
        defaultOpen={true}
        persistKey={`plan:${planName}:section:brief`}
        copyMarkdown={sectionMarkdown("Brief", content)}
      >
        <Markdown>{content}</Markdown>
      </CollapsibleSection>
    </section>
  );
}

function PhasesSection({
  phases,
  heading,
  testId,
  planName,
}: {
  phases: Phase[];
  heading: string;
  testId: string;
  planName: string;
}) {
  if (phases.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
      <div className="flex flex-col gap-2">
        {phases.map((phase) => (
          <CollapsibleSection
            key={phase.number}
            title={`Phase ${phase.number}${phase.title ? `: ${phase.title}` : ""}`}
            defaultOpen={false}
            persistKey={`plan:${planName}:phase:${phase.number}`}
            copyMarkdown={phaseMarkdown(phase)}
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
                            <Badge variant={stateToBadge(row.state)}>
                              {row.state}
                            </Badge>
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
