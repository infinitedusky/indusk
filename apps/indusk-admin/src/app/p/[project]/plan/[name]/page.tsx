import { readPlanParts } from "@infinitedusky/indusk-mcp/plans/parts";
import { readHealthNames } from "@infinitedusky/indusk-mcp/promises/display";
import { notFound } from "next/navigation";
import { DecisionCard } from "@/components/cockpit/DecisionCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ParentPlanView, type SubplanEntry } from "@/components/ParentPlanView";
import { PlanWorkflows } from "@/components/PlanWorkflows";
import { PlanFrame } from "@/components/plan/PlanFrame";
import { PlanParts, WaitingAmendments } from "@/components/plan/PlanParts";
import { PlanStatusCard } from "@/components/plan/PlanStatusCard";
import { BuildControls } from "@/components/session/BuildControls";
import { PlanSession } from "@/components/session/PlanSession";
import { TrustNotice } from "@/components/session/TrustNotice";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { PlanCopyNotice } from "@/components/Worktrees";
import { readPlanHistory, readWaiting } from "@/lib/decisions-reader";
import { planActions } from "@/lib/plan-actions";
import {
  readActivePlans,
  readArchivedPlans,
  readPlanHierarchy,
  readPlanMasterContent,
} from "@/lib/planning-reader";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";
import { projectTrusted } from "@/lib/trust-reader";

interface PlanPageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * Server component for `/p/{project}/plan/{name}`. Resolves the project's
 * path via the registry, reads every active + archived plan for that
 * project, finds the requested plan by folder name, and renders the plan's frame, parts and stage.
 *
 * The stale-project branch (path null OR deleted on disk) is handled by
 * the layout (`app/p/[project]/layout.tsx`) — it replaces its own output
 * with `<StaleProjectFailurePage>` in that case, so this page's rendered
 * element is never placed in the DOM. We early-return `null` when path is
 * stale so the page's own code doesn't trip on `readActivePlans` against
 * a deleted dir. `notFound()` is reserved for the genuinely plan-not-found
 * case (path OK, plan name wrong).
 */
export default async function PlanPage({ params }: PlanPageProps) {
  const { project, name } = await params;
  const projectPath = getProjectPath(project);
  if (!projectPath || !projectPathExists(projectPath)) return null;

  const [active, archived] = await Promise.all([
    readActivePlans(projectPath),
    readArchivedPlans(projectPath),
  ]);
  const plan =
    active.find((p) => p.name === name) ??
    archived.find((p) => p.name === name);
  if (!plan) {
    notFound();
  }

  // Parent plan? Resolve its declared children against what exists on disk
  // (dawn-ui-plan-grouping Phase 3). Missing/corrupt declarations yield an
  // empty list here, and the page shows the standard stage —
  // grouping never hides a plan.
  const planHierarchy = readPlanHierarchy(projectPath);
  const declared = planHierarchy.subplans[name] ?? [];
  let subplans: SubplanEntry[] | undefined;
  let masterContent: string | undefined;
  if (declared.length > 0) {
    // Archived first so an active plan overwrites it on a name collision —
    // matching the `active.find ?? archived.find` precedence above (T11).
    const byName = new Map(
      [...archived, ...active].map((p) => [p.name, p] as const),
    );
    subplans = declared.map((n) => ({ name: n, plan: byName.get(n) }));
    masterContent =
      (await readPlanMasterContent(projectPath, name)) ?? undefined;
  }

  // Only the plan page is live: it re-renders itself on an interval so a
  // checkoff on disk reaches an open page without a reload (Build Phase 5).
  // The dates the released card reads come from the package.
  const dates = readHealthNames(projectPath).planDates[name];

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
  const waiting = plan.archived ? undefined : readWaiting(project, [plan])[0];

  // The brief's three parts, read by the package from the checkout the plan is
  // worked in (its worktree, else the project's own), on every request, so a
  // promise or a look the agent writes shows on the next refresh.
  const checkout = plan.worktree?.path ?? projectPath;
  const parts = await readPlanParts(checkout, name, {
    archived: plan.archived || Boolean(plan.archivedInWorktree),
  });

  // The page draws what its approved mockups draw (`plan.parts`,
  // `plan.needs-you`, `plan.working`, `plan.released`): the frame's crumb, name
  // and tag, the three parts with the one link to the brief, then the rail of
  // the two workflows beside what the plan waits on — the amendment card, then
  // the decision card (or what is being built, or released). The documents are
  // read on the brief page, not here. The notices, the controls to plan or
  // build and the parent's subplan cards appear only when there is something to
  // say or ask; they are conditional, not regions of the mockups.
  const main = (
    <>
      <WaitingAmendments project={project} plan={name} parts={parts} />
      {waiting ? (
        <DecisionCard project={project} waiting={waiting} />
      ) : (
        <PlanStatusCard plan={plan} dates={dates} />
      )}
      <PlanSession
        project={project}
        plan={name}
        canApprove={actions.canApprove && waiting?.on !== "approval"}
        canPlan={actions.canPlan}
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

  return (
    <>
      <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
      <PlanFrame project={project} plan={plan}>
        <PlanCopyNotice plan={plan} />
        <TrustNotice project={project} trusted={projectTrusted(projectPath)} />
        {plan.malformed ? <MalformedNotice /> : null}
        <PlanParts
          parts={parts}
          briefHref={`/p/${project}/plan/${name}/brief`}
          looksHref={`/p/${project}/looks?${plan.worktree ? `checkout=${encodeURIComponent(name)}` : ""}`}
        />
        {subplans ? (
          <ParentPlanView
            subplans={subplans}
            masterContent={masterContent}
            prefix={`/p/${project}/plan/`}
          />
        ) : null}
        <div
          className="cols-plan-stage grid items-start gap-5"
          data-testid="plan-stage"
        >
          {subplans ? null : <PlanWorkflows plan={plan} />}
          <div className="flex min-w-0 flex-col gap-3">{main}</div>
        </div>
        <HistoryPanel entries={readPlanHistory(projectPath, name)} />
      </PlanFrame>
    </>
  );
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
