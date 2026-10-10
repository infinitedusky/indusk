import type { PlanDates } from "@infinitedusky/indusk-mcp/promises/display";
import { PlanBar } from "@/components/bars/PlanBar";
import {
  activePhaseLabel,
  activePhaseOf,
  ProgressLines,
} from "@/components/bars/ProgressLines";
import { CleanupSection } from "@/components/CleanupSection";
import { FalsificationSection } from "@/components/FalsificationSection";
import { HoldingBadge } from "@/components/HoldingBadge";
import { Markdown } from "@/components/Markdown";
import { PapersSection } from "@/components/PapersSection";
import { ParentPlanView, type SubplanEntry } from "@/components/ParentPlanView";
import { PhasesSection } from "@/components/PhasesSection";
import { PlanTypeChip } from "@/components/PlanTypeChip";
import { PlanWorkflows } from "@/components/PlanWorkflows";
import { Badge } from "@/components/ui/Badge";
import { statusToBadge } from "@/components/ui/badge-variant";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { CopyButton } from "@/components/ui/CopyButton";
import { PlanCopyNotice, WorktreeChip } from "@/components/Worktrees";
import { planMarkdown, sectionMarkdown } from "@/lib/markdown-export";
import { extractPhases, splitPhasesAroundFalsification } from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/** A promise this plan owns, as the header shows it: its sentence and its tests, both from the package. */
export interface PlanPromiseChip {
  name: string;
  sentence: string;
  standing: string;
  tests: { passing: number; total: number };
}

/** The facts the header adds to the plan's name; every one is read by the package, none worked out here. */
export interface PlanHeaderFacts {
  title?: string;
  dates?: PlanDates;
  /** The Paths (parent plans) that declare this plan, outermost first. */
  paths?: string[];
  promises?: PlanPromiseChip[];
}

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
        promisesHref={promisesHrefFrom(planHrefPrefix)}
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
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
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
 * The project's Promises page, beside its plan pages: a plan is at
 * `<base>/plan/<name>`, the registry at `<base>/promises`.
 */
function promisesHrefFrom(planHrefPrefix: string): string {
  return planHrefPrefix.replace(/plan\/$/, "promises");
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
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
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
                <p className="text-sm text-gray-700">Skipped: {r.reason}</p>
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

function PlanHeader({
  plan,
  holding = 0,
  showType = false,
  facts,
  promisesHref,
  planHrefPrefix,
}: {
  plan: Plan;
  holding?: number;
  /**
   * Whether the type chip is drawn — true whenever the plan bar is. The bar
   * can say "this plan declares no type" under itself, and a page that says
   * so must carry the chip that says it and explains it (A24). A parent has
   * a master bar, no plan bar, and no document to declare a type in.
   */
  showType?: boolean;
  facts?: PlanHeaderFacts;
  promisesHref: string;
  planHrefPrefix: string;
}) {
  const title = facts?.title && facts.title !== plan.name ? facts.title : null;
  return (
    <header
      className="flex flex-col gap-3 border-b border-gray-200 pb-3"
      data-testid="plan-header"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-gray-900">
            {title ?? plan.name}
          </h1>
          {title && (
            <span className="font-mono text-xs text-gray-500">{plan.name}</span>
          )}
          <span className="flex items-center gap-2 text-xs text-gray-500">
            {plan.archived ? "archived" : "active"}
            {showType && (
              <PlanTypeChip
                workflow={plan.workflow ?? null}
                declared={plan.workflowDeclared ?? null}
              />
            )}
            <WorktreeChip plan={plan} />
            <HoldingBadge count={holding} plan={plan.name} />
          </span>
          <HeaderFacts
            facts={facts}
            promisesHref={promisesHref}
            planHrefPrefix={planHrefPrefix}
          />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
          <CopyButton
            text={planMarkdown(plan)}
            label="Copy whole plan as markdown"
            data-testid="copy-plan-button"
          />
        </div>
      </div>
    </header>
  );
}

/** "started 2026-09-01 · landed 2026-09-20 · released 1.70.0 (2026-10-02)", only what has happened. */
function datesLine(dates: PlanDates): string {
  return [
    dates.started ? `started ${dates.started}` : null,
    dates.landed ? `landed ${dates.landed}` : null,
    dates.released
      ? `released ${dates.released.version} (${dates.released.date})`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function HeaderFacts({
  facts,
  promisesHref,
  planHrefPrefix,
}: {
  facts?: PlanHeaderFacts;
  promisesHref: string;
  planHrefPrefix: string;
}) {
  if (!facts) return null;
  const dates = facts.dates ? datesLine(facts.dates) : "";
  const paths = facts.paths ?? [];
  const promises = facts.promises ?? [];
  if (!dates && paths.length === 0 && promises.length === 0) return null;
  return (
    <div
      className="mt-2 flex flex-col gap-1 text-xs text-gray-600"
      data-testid="plan-header-facts"
    >
      {dates && <span data-testid="plan-dates">{dates}</span>}
      {paths.length > 0 && (
        <span data-testid="plan-path">
          Path:{" "}
          {paths.map((path, i) => (
            <span key={path}>
              {i > 0 && " › "}
              <a className="underline" href={`${planHrefPrefix}${path}`}>
                {path}
              </a>
            </span>
          ))}
        </span>
      )}
      {promises.length > 0 && (
        <ul className="flex flex-wrap gap-1" data-testid="plan-promises">
          {promises.map((p) => (
            <li key={p.name}>
              <a
                href={`${promisesHref}/${p.name}`}
                title={`${p.sentence} — ${p.standing}`}
                data-standing={p.standing}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5"
              >
                {p.sentence}
                <span className="text-gray-500">
                  {p.tests.passing}/{p.tests.total} tests
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
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
