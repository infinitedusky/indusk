import { phaseLabel } from "@infinitedusky/indusk-mcp/impl-headings";
import { parseImplString } from "@infinitedusky/indusk-mcp/impl-parser";
import { ACTIVITY_LABELS } from "@/components/bars/labels";
import { PhaseBar } from "@/components/bars/PhaseBar";
import { PhasesBar } from "@/components/bars/PhasesBar";
import { PlanBar } from "@/components/bars/PlanBar";
import { FalsificationSection } from "@/components/FalsificationSection";
import { Markdown } from "@/components/Markdown";
import { PapersSection } from "@/components/PapersSection";
import { ParentPlanView, type SubplanEntry } from "@/components/ParentPlanView";
import { PhasesSection } from "@/components/PhasesSection";
import { Badge } from "@/components/ui/Badge";
import { statusToBadge } from "@/components/ui/badge-variant";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { CopyButton } from "@/components/ui/CopyButton";
import { deriveActivePhase } from "@/lib/active-phase";
import { planMarkdown, sectionMarkdown } from "@/lib/markdown-export";
import {
  extractPhases,
  phaseTitle,
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

      {plan.position && !isParent && (
        <PlanBar position={plan.position} activity={activePhaseLabel(plan)} />
      )}

      {!plan.boundaryError && <ActivePhaseBar plan={plan} />}

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

      {plan.papers && plan.papers.length > 0 && (
        <PapersSection planName={plan.name} papers={plan.papers} />
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
/**
 * The active phase, by ADR D4: most recent boundary record among open phases,
 * else the first open phase with a hint. Null when the record file is
 * malformed — the page shows the error instead of guessing.
 */
function activePhaseOf(plan: Plan) {
  if (!plan.impl || plan.boundaryError) return null;
  return deriveActivePhase(
    parseImplString(plan.impl.content).phases,
    plan.boundaries ?? [],
  );
}

/** "verifying Build Phase 2" — the plan bar's label while executing. */
function activePhaseLabel(plan: Plan): string | null {
  if (!plan.impl) return null;
  const active = activePhaseOf(plan);
  if (!active?.ref) return null;
  const phase = extractPhases(plan.impl.content, plan.impl.trajectory).find(
    (p) => p.kind === active.ref?.kind && p.number === active.ref?.number,
  );
  if (!phase) return null;
  return `${ACTIVITY_LABELS[phase.activity]} ${phaseLabel(active.ref)}`;
}

/**
 * The active phase at the top of the page, under the plan bar — what is
 * happening now, readable before any section is opened. The hint marks a
 * guess (no boundary record) as a guess, never as a confident marker.
 */
function ActivePhaseBar({ plan }: { plan: Plan }) {
  if (!plan.impl) return null;
  const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
  if (phases.length === 0) return null;
  const active = activePhaseOf(plan);
  const activePhase = active?.ref
    ? phases.find(
        (p) => p.kind === active.ref?.kind && p.number === active.ref?.number,
      )
    : undefined;
  const activeKey = activePhase
    ? `${activePhase.kind}-${activePhase.number}`
    : null;
  return (
    <div className="flex flex-col gap-3" data-testid="impl-progress">
      <PhasesBar phases={phases} activeKey={activeKey} />
      {activePhase && (
        <section
          className="flex flex-col gap-1"
          data-testid="phase-bar-active"
          data-phase={activeKey}
        >
          <h2 className="text-sm font-semibold text-gray-900">
            Active: {phaseTitle(activePhase)}
            {activePhase.title ? `: ${activePhase.title}` : ""}
            {active?.hint ? (
              <span className="ml-2 text-xs font-normal text-amber-700">
                ({active.hint} — first open phase in document order)
              </span>
            ) : null}
          </h2>
          <PhaseBar phase={activePhase} />
        </section>
      )}
    </div>
  );
}

function ImplSections({ plan }: { plan: Plan }) {
  if (!plan.impl) return null;
  const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
  const split = splitPhasesAroundFalsification(phases);
  const active = activePhaseOf(plan);
  const activeKey = active?.ref
    ? `${active.ref.kind}-${active.ref.number}`
    : null;
  return (
    <>
      {plan.boundaryError && (
        <div
          role="alert"
          data-testid="boundary-error"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          The phase-boundary record could not be read, so no phase is marked
          active: {plan.boundaryError}
        </div>
      )}
      {split.pre.length > 0 && (
        <PhasesSection
          phases={split.pre}
          heading="Phases"
          testId="phases-section"
          planName={plan.name}
          activeKey={activeKey}
        />
      )}
      <FalsificationSection plan={plan} phase={split.falsification} />
      {split.post.length > 0 && (
        <PhasesSection
          phases={split.post}
          heading="Follow-up Phases"
          testId="followup-phases-section"
          planName={plan.name}
          activeKey={activeKey}
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
