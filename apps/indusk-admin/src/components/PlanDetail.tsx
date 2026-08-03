import type {
  HypothesisEntry,
  HypothesisOutcome,
  LogEntry,
  TerminatorEntry,
} from "@infinitedusky/indusk-mcp/falsification/log";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
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
  falsificationLogMarkdown,
  falsificationPhaseMarkdown,
  phaseMarkdown,
  planMarkdown,
  sectionMarkdown,
} from "@/lib/markdown-export";
import {
  extractChecklistItems,
  extractPhases,
  type Phase,
  splitPhasesAroundFalsification,
} from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/** A declared subplan resolved for the parent detail view. */
export interface SubplanEntry {
  /** Declared name from the parent's master.md `subplans:` list. */
  name: string;
  /** The resolved plan when its folder exists; absent → placeholder card. */
  plan?: Plan;
}

interface PlanDetailProps {
  plan: Plan;
  /**
   * Declared subplans when this plan is a parent (its master.md names
   * `subplans:`). Non-empty → the detail view renders a card per subplan
   * instead of the standard document sections, which a parent doesn't carry
   * (its documents are master.md/maxims.md — outside DOC_FILES).
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
        <ParentPlanView subplans={subplans} prefix={planHrefPrefix} />
      )}

      {!isParent && plan.research && (
        <CollapsibleSection
          title="Research"
          defaultOpen={!plan.brief}
          persistKey={`plan:${plan.name}:section:research`}
          copyMarkdown={sectionMarkdown("Research", plan.research.content)}
        >
          <Markdown>{plan.research.content}</Markdown>
        </CollapsibleSection>
      )}

      {!isParent && plan.brief && (
        <BriefSection planName={plan.name} content={plan.brief.content} />
      )}

      {!isParent && plan.testPlan && (
        <CollapsibleSection
          title="Test Plan"
          defaultOpen={false}
          persistKey={`plan:${plan.name}:section:test-plan`}
          copyMarkdown={sectionMarkdown("Test Plan", plan.testPlan.content)}
        >
          <Markdown>{plan.testPlan.content}</Markdown>
        </CollapsibleSection>
      )}

      {!isParent && plan.adr && (
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

      {!isParent && plan.impl && <ImplSections plan={plan} />}
      {!isParent && !plan.impl && hasAnyDocument && (
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

/**
 * Detail view for a parent plan — a card per declared subplan, in declared
 * order, instead of the standard document sections (a parent's documents are
 * master.md/maxims.md, none of which are DOC_FILES). Same semantics as the
 * sidebar group: real subplans navigate, declared-but-uncreated ones render
 * as placeholders.
 */
function ParentPlanView({
  subplans,
  prefix,
}: {
  subplans: SubplanEntry[];
  prefix: string;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid="subplan-cards">
      <h2 className="text-base font-semibold text-gray-900">Subplans</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {subplans.map((entry) =>
          entry.plan ? (
            <SubplanCard key={entry.name} plan={entry.plan} prefix={prefix} />
          ) : (
            <SubplanPlaceholderCard key={entry.name} name={entry.name} />
          ),
        )}
      </div>
    </section>
  );
}

function SubplanCard({ plan, prefix }: { plan: Plan; prefix: string }) {
  return (
    <div data-testid={`subplan-card-${plan.name}`}>
      <Link
        href={`${prefix}${plan.name}`}
        className="flex flex-col gap-1 rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-gray-900">
            {plan.name}
          </span>
          <Badge variant={statusToBadge(plan.status)}>{plan.status}</Badge>
        </div>
        <span className="text-xs text-gray-500">{planStage(plan)}</span>
      </Link>
    </div>
  );
}

/**
 * A declared subplan with no folder yet — same semantics as the sidebar's
 * greyed placeholder: visually distinct, non-navigable, showing the work
 * queued ahead.
 */
function SubplanPlaceholderCard({ name }: { name: string }) {
  return (
    <div
      data-testid={`subplan-placeholder-${name}`}
      className="flex flex-col gap-1 rounded border border-dashed border-gray-200 px-3 py-2"
      title="Declared in the parent's master.md — not created yet"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-gray-400">{name}</span>
        <Badge variant="neutral">planned</Badge>
      </div>
      <span className="text-xs text-gray-400">not created yet</span>
    </div>
  );
}

/** Furthest lifecycle document the plan carries — the card's "stage". */
function planStage(plan: Plan): string {
  if (plan.retrospective) return "retrospective";
  if (plan.impl) return "impl";
  if (plan.adr) return "adr";
  if (plan.testPlan) return "test-plan";
  if (plan.brief) return "brief";
  if (plan.research) return "research";
  return "no documents yet";
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

function FalsificationSection({
  plan,
  phase,
}: {
  plan: Plan;
  phase: Phase | null;
}) {
  // Priority: phase-authoring flow (new, 1.27.4+) > legacy log file > empty state.
  if (phase) {
    return <FalsificationPhaseSection planName={plan.name} phase={phase} />;
  }
  if (!plan.falsification) {
    return (
      <section
        className="flex flex-col gap-2"
        data-testid="falsification-section"
      >
        <CollapsibleSection
          title="Falsification"
          defaultOpen={true}
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
        defaultOpen={true}
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

/**
 * Render a falsification phase (new phase-authoring flow, 1.27.4+). Hypotheses
 * come from the phase's trajectory rows (each row == one hypothesis); fix items
 * come from the phase's checklist. Status badge derives from the combined state
 * of trajectory rows + unchecked checklist items.
 */
function FalsificationPhaseSection({
  planName,
  phase,
}: {
  planName: string;
  phase: Phase;
}) {
  const checklistItems = extractChecklistItems(phase.content);
  const allTrajectoryTerminal = phase.trajectoryRows.every(
    (r) => r.state === "passing" || r.state === "skipped",
  );
  const allItemsChecked = checklistItems.every((i) => i.checked);
  const complete = allTrajectoryTerminal && allItemsChecked;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="falsification-section"
    >
      <CollapsibleSection
        title={
          <>
            Falsification
            {phase.title ? (
              <span className="ml-2 text-xs font-normal text-gray-500">
                (Phase {phase.number}: {phase.title})
              </span>
            ) : null}
          </>
        }
        defaultOpen={true}
        persistKey={`plan:${planName}:section:falsification`}
        headerRight={
          <Badge variant={complete ? "passing" : "writable"}>
            {complete ? "complete" : "in-progress"}
          </Badge>
        }
        copyMarkdown={falsificationPhaseMarkdown(phase)}
      >
        <div className="flex flex-col gap-2">
          {phase.trajectoryRows.length > 0 && (
            <div data-testid="falsification-hypotheses">
              <h3 className="text-sm font-semibold text-gray-800 mt-1">
                Hypotheses
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Asserts</TableHead>
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

          {checklistItems.length > 0 && (
            <div data-testid="falsification-fix-items" className="mt-2">
              <h3 className="text-sm font-semibold text-gray-800">Fix items</h3>
              <ul className="flex flex-col gap-1">
                {checklistItems.map((item) => (
                  <li
                    key={`${item.checked ? "x" : "o"}-${item.text}`}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="font-mono text-xs text-gray-500">
                      [{item.checked ? "x" : " "}]
                    </span>
                    <span
                      className={
                        item.checked ? "text-gray-500 line-through" : ""
                      }
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
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

function statusToBadge(status: string): BadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized.includes("completed") || normalized.includes("passing"))
    return "passing";
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("in-progress") || normalized.includes("accepted"))
    return "writable";
  if (normalized.includes("draft") || normalized.includes("planned"))
    return "planned";
  return "neutral";
}

function stateToBadge(state: string): BadgeVariant {
  const normalized = state.toLowerCase();
  if (
    [
      "passing",
      "blocked",
      "skipped",
      "planned",
      "writable",
      "written",
    ].includes(normalized)
  ) {
    return normalized as BadgeVariant;
  }
  return "neutral";
}
