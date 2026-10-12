import { PlanBar } from "@/components/bars/PlanBar";
import {
  activePhaseLabel,
  activePhaseOf,
  ProgressLines,
} from "@/components/bars/ProgressLines";
import { CleanupSection } from "@/components/CleanupSection";
import { FalsificationSection } from "@/components/FalsificationSection";
import { Markdown } from "@/components/Markdown";
import { PapersSection } from "@/components/PapersSection";
import { ParentPlanView, type SubplanEntry } from "@/components/ParentPlanView";
import { PhasesSection } from "@/components/PhasesSection";
import { PlanWorkflows } from "@/components/PlanWorkflows";
import {
  PlanHeader,
  type PlanHeaderFacts,
  promisesHrefFrom,
} from "@/components/plan/PlanHeader";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { PlanCopyNotice } from "@/components/Worktrees";
import { sectionMarkdown } from "@/lib/markdown-export";
import { extractPhases, splitPhasesAroundFalsification } from "@/lib/phases";
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
  /** How many promises this plan holds (owns, not retired) — "holding N" in the header. */
  holding?: number;
  /** Title, dates, Path and promise chips for the header (plan-cockpit). */
  header?: PlanHeaderFacts;
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
  holding = 0,
  header,
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
  // The plan bar is drawn for a plan that has a position and is not a parent
  // (a parent has a master bar). The type chip is drawn exactly when the bar
  // is, so the condition is stated once: the bar can say "this plan declares
  // no type", and the page must then carry the chip that explains it (A24).
  const position = isParent ? undefined : plan.position;
  return (
    <article
      className="flex flex-col gap-6"
      data-testid="plan-detail"
      data-plan-name={plan.name}
    >
      <PlanHeader
        plan={plan}
        holding={holding}
        showType={position !== undefined}
        facts={header}
        planHrefPrefix={planHrefPrefix}
      />

      <PlanCopyNotice plan={plan} />

      {position && (
        <PlanBar
          position={position}
          activity={activePhaseLabel(plan)}
          workflow={plan.workflow ?? null}
          declared={plan.workflowDeclared ?? null}
        />
      )}

      {!plan.boundaryError && <ProgressLines plan={plan} />}

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

      {!isParent && <PlanWorkflows plan={plan} />}

      <details className="flex flex-col gap-6" data-testid="plan-details">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Details
        </summary>
        <div className="mt-4 flex flex-col gap-6">
          {plan.research && (
            <CollapsibleSection
              title="Research"
              defaultOpen={false}
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

          {plan.impl && (
            <ImplSections
              plan={plan}
              promisesHref={promisesHrefFrom(planHrefPrefix)}
            />
          )}
          {!plan.impl && hasAnyDocument && (
            <FalsificationSection plan={plan} phase={null} />
          )}
        </div>
      </details>
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
function ImplSections({
  plan,
  promisesHref,
}: {
  plan: Plan;
  promisesHref: string;
}) {
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
          className="rounded-md border border-bad bg-bad-wash px-3 py-2 text-sm text-bad"
        >
          The phase-boundary record could not be read, so no phase is marked
          active: {plan.boundaryError}
        </div>
      )}
      {split.pre.length > 0 && (
        <PhasesSection
          phases={split.pre}
          heading="Implementation Plan"
          testId="phases-section"
          planName={plan.name}
          activeKey={activeKey}
          promisesHref={promisesHref}
        />
      )}
      <FalsificationSection
        plan={plan}
        phase={split.falsification}
        promisesHref={promisesHref}
      />
      {split.cleanup && (
        <CleanupSection
          planName={plan.name}
          phase={split.cleanup}
          promisesHref={promisesHref}
        />
      )}
      {!split.cleanup &&
        plan.skippedRituals
          ?.filter((r) => r.ritual === "cleanup")
          .map((r) => (
            <section
              key="cleanup-skipped"
              className="flex flex-col gap-2"
              data-testid="cleanup-skipped"
            >
              <CollapsibleSection
                title="Cleanup"
                defaultOpen
                persistKey={`plan:${plan.name}:section:cleanup`}
                copyMarkdown={`## Cleanup\n\nSkipped: ${r.reason}\n`}
              >
                <p className="text-sm text-ink-soft">Skipped: {r.reason}</p>
              </CollapsibleSection>
            </section>
          ))}
      {split.post.length > 0 && (
        <PhasesSection
          phases={split.post}
          heading="Follow-up Phases"
          testId="followup-phases-section"
          planName={plan.name}
          activeKey={activeKey}
          promisesHref={promisesHref}
        />
      )}
    </>
  );
}

function MalformedBanner() {
  return (
    <div
      className="rounded-md border border-bad bg-bad-wash px-3 py-2 text-sm text-bad"
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
        defaultOpen={false}
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
      <h2 className="text-base font-semibold text-ink">
        Raw documents (malformed frontmatter)
      </h2>
      <p className="text-xs text-ink-faint">
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
              className="overflow-x-auto rounded-md bg-ground p-3 text-xs font-mono text-ink whitespace-pre-wrap"
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
