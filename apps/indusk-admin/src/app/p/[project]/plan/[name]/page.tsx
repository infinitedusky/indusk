import { readPlanParts } from "@infinitedusky/indusk-mcp/plans/parts";
import { readHealthNames } from "@infinitedusky/indusk-mcp/promises/display";
import { activePhaseOf } from "@/components/bars/ProgressLines";
import { DecisionCard } from "@/components/cockpit/DecisionCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PlanWorkflows } from "@/components/PlanWorkflows";
import { MasterStory } from "@/components/plan/MasterStory";
import { PlanFrame } from "@/components/plan/PlanFrame";
import {
  DocumentsPart,
  PhasesPart,
  PlanParts,
  WaitingAmendments,
} from "@/components/plan/PlanParts";
import { PlanStatusCard } from "@/components/plan/PlanStatusCard";
import { PlanSummary } from "@/components/plan/PlanSummary";
import { BuildControls } from "@/components/session/BuildControls";
import { PlanSession, planOpening } from "@/components/session/PlanSession";
import { TrustNotice } from "@/components/session/TrustNotice";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { PlanCopyNotice } from "@/components/Worktrees";
import { readPlanHistory, readWaiting } from "@/lib/decisions-reader";
import { planLookState } from "@/lib/look-state";
import { masterStory } from "@/lib/master-story";
import { extractPhases } from "@/lib/phases";
import { planActions } from "@/lib/plan-actions";
import { buildGroups, groupOf } from "@/lib/plan-groups";
import { readPlanPage } from "@/lib/plan-page";
import { planDocuments } from "@/lib/plan-parts-view";
import {
  readActivePlans,
  readArchivedPlans,
  readPlanHierarchy,
} from "@/lib/planning-reader";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { projectTrusted } from "@/lib/trust-reader";

interface PlanPageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * Server component for `/p/{project}/plan/{name}`: renders the plan's frame,
 * parts and stage. The plan comes from `readPlanPage` — null for a stale
 * project (the layout replaces this page's output then), `notFound()` for a
 * plan that does not exist.
 */
export default async function PlanPage({ params }: PlanPageProps) {
  const { project, name } = await params;
  const found = await readPlanPage(project, name);
  if (!found) return null;
  const { projectPath, plan } = found;

  // A master (a plan that declares subplans) tells its story instead of
  // showing a plan's stage: `plan.master`, its rows the Path group the nav
  // counts. Missing or corrupt declarations leave the standard page — grouping
  // never hides a plan.
  const grouping = readPlanHierarchy(projectPath);
  if ((grouping.subplans[name] ?? []).length > 0) {
    const master = await masterPage(project, projectPath, name, grouping);
    if (master) {
      return (
        <>
          <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
          <PlanFrame
            project={project}
            plan={plan}
            lookState={planLookState({
              archived: false,
              waiting: false,
              briefStatus: null,
              master: true,
            })}
            master
          >
            <PlanCopyNotice plan={plan} />
            {plan.malformed ? <MalformedNotice /> : null}
            <MasterStory
              purpose={plan.description}
              story={master}
              masterHref={`/p/${project}/plan/${name}/doc/master`}
            />
          </PlanFrame>
        </>
      );
    }
  }

  // The dates the released card reads come from the package.
  const dates = (await readHealthNames(projectPath)).planDates[name];

  // What the page offers, one rule for a normal-mode plan (its worktree) and
  // a workbench plan (its code file) — workbench-plan-authoring A10.
  const actions = planActions({
    worktree: plan.worktree,
    code: plan.code,
    implStatus: plan.impl?.frontmatter.status as string | undefined,
    position: plan.position?.position,
  });

  // The one decision the plan waits on, and what it was answered before
  // (plan-cockpit, ADR decision 4). Approve and the review's Accept live on
  // the card while it waits on them, so neither is offered twice.
  const waiting = plan.archived
    ? undefined
    : (await readWaiting(project, projectPath, [plan]))[0];

  // The brief's three parts, read by the package from the checkout the plan is
  // worked in (its worktree, else the project's own), on every request, so a
  // promise or a look the agent writes shows on the next refresh.
  const checkout = plan.worktree?.path ?? projectPath;
  const parts = await readPlanParts(checkout, name, {
    archived: plan.archived || Boolean(plan.archivedInWorktree),
  });

  // The page draws what its approved mockups draw (`plan.working`,
  // `plan.phases`, `plan.documents`, ...): the frame's crumb, name and tag; the
  // status, always open — the rail of the two workflows beside what the plan
  // waits on (the amendment card, then the decision card, or what is being
  // built, or released) and the Build control; then every other part folded to
  // a row of its name and one line: Promises, Expectations, Looks, Phases,
  // Documents, History. The notices, the controls to plan or build and the
  // parent's subplan cards appear only when there is something to say or ask;
  // they are conditional, not regions of the mockups.
  const phases = plan.impl
    ? extractPhases(plan.impl.content, plan.impl.trajectory)
    : [];
  const activeRef = activePhaseOf(plan)?.ref;
  const activeKey = activeRef ? `${activeRef.kind}-${activeRef.number}` : null;
  const documentHref = (slug: string) =>
    `/p/${project}/plan/${name}/${slug === "brief" ? "brief" : `doc/${slug}`}`;
  const main = (
    <>
      <PlanSummary
        description={parts.description}
        briefStatus={parts.briefStatus}
        briefHref={`/p/${project}/plan/${name}/brief`}
        archived={plan.archived || Boolean(plan.archivedInWorktree)}
      />
      <WaitingAmendments project={project} plan={name} parts={parts} />
      {waiting && waiting.on !== "amendment" ? (
        <DecisionCard project={project} waiting={waiting} />
      ) : (
        <PlanStatusCard plan={plan} dates={dates} />
      )}
      <PlanSession
        project={project}
        plan={name}
        canApprove={actions.canApprove && waiting?.on !== "approval"}
        canPlan={actions.canPlan}
        opening={planOpening}
        startLabel="Ask about this plan"
      />
      {actions.showBuild ? (
        <BuildControls
          project={project}
          plan={name}
          canBuild={actions.canBuild}
          inReview={actions.inReview && waiting?.on !== "review"}
        />
      ) : null}
    </>
  );

  // Only the plan page is live: it re-renders itself on an interval so a
  // checkoff on disk reaches an open page without a reload.
  return (
    <>
      <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
      <PlanFrame
        project={project}
        plan={plan}
        lookState={planLookState({
          archived: plan.archived || Boolean(plan.archivedInWorktree),
          position: plan.position?.position,
          waiting: waiting !== undefined,
          briefStatus: parts.briefStatus,
        })}
      >
        <PlanCopyNotice plan={plan} />
        <TrustNotice project={project} trusted={projectTrusted(projectPath)} />
        {plan.malformed ? <MalformedNotice /> : null}
        <section className="grid gap-3" data-testid="plan-status">
          <div
            className="cols-plan-stage grid items-start gap-5"
            data-testid="plan-stage"
          >
            <PlanWorkflows plan={plan} project={project} />
            <div className="flex min-w-0 flex-col gap-3">{main}</div>
          </div>
        </section>
        <div className="grid gap-2" data-testid="plan-parts">
          <PlanParts
            parts={parts}
            looksHref={`/p/${project}/looks?${plan.worktree ? `checkout=${encodeURIComponent(name)}` : ""}`}
          />
          <PhasesPart phases={phases} activeKey={activeKey} />
          <DocumentsPart
            documents={planDocuments(plan)}
            hrefOf={documentHref}
          />
          <HistoryPanel entries={readPlanHistory(projectPath, name)} />
        </div>
      </PlanFrame>
    </>
  );
}

/**
 * A master's rows and counts, from the Path group built over the plans as the
 * nav reads them; undefined when the declarations leave this plan no Path.
 * Archived plans go first so an active plan wins a name collision, as in
 * `readPlanPage`.
 */
async function masterPage(
  project: string,
  projectPath: string,
  name: string,
  grouping: ReturnType<typeof readPlanHierarchy>,
) {
  const [active, archived] = await Promise.all([
    readActivePlans(projectPath),
    readArchivedPlans(projectPath),
  ]);
  const { planDates } = await readHealthNames(projectPath);
  const isReleased = (n: string) => (planDates[n]?.released ?? null) !== null;
  const group = groupOf(
    buildGroups(active, archived, grouping, isReleased).groups,
    name,
  );
  if (!group) return undefined;
  const waiting = await readWaiting(project, projectPath, active);
  return masterStory(group, grouping.declaredTitles, isReleased, {
    prefix: `/p/${project}/plan/`,
    waiting: Object.fromEntries(waiting.map((w) => [w.plan, w.step])),
  });
}

function MalformedNotice() {
  return (
    <div
      className="rounded-md border border-bad bg-bad-wash px-3 py-2 text-sm text-bad"
      data-testid="malformed-banner"
    >
      This plan has malformed YAML frontmatter. Some of it may be missing or
      read as defaults.
    </div>
  );
}
