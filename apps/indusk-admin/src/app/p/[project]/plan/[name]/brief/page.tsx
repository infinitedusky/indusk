import { readPlanParts } from "@infinitedusky/indusk-mcp/plans/parts";
import { LiveRefresh } from "@/components/LiveRefresh";
import { Markdown } from "@/components/Markdown";
import { PlanFrame } from "@/components/plan/PlanFrame";
import { PlanParts } from "@/components/plan/PlanParts";
import { FollowAgent } from "@/components/session/FollowAgent";
import { PlanSession } from "@/components/session/PlanSession";
import { TrustNotice } from "@/components/session/TrustNotice";
import { WindowColumn } from "@/components/session/WindowColumn";
import { readWaiting } from "@/lib/decisions-reader";
import { briefLookState } from "@/lib/look-state";
import { planActions } from "@/lib/plan-actions";
import { readPlanHealth } from "@/lib/plan-health";
import { readPlanPage } from "@/lib/plan-page";
import { planDocuments } from "@/lib/plan-parts-view";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { projectTrusted } from "@/lib/trust-reader";

interface BriefPageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * `/p/{project}/plan/{name}/brief` — where a plan is written: its promises,
 * expectations and looks and the brief itself on the left, the agent the
 * person writes it with in a narrower column on the right. A draft's accepted name
 * lands here; Approve moves to the plan's page, where Build starts the build.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export default async function PlanBriefPage({ params }: BriefPageProps) {
  const { project, name } = await params;
  const found = await readPlanPage(project, name);
  if (!found) return null;
  const { projectPath, plan } = found;

  const waiting = plan.archived
    ? undefined
    : (await readWaiting(project, projectPath, [plan]))[0];
  const actions = planActions({
    worktree: plan.worktree,
    code: plan.code,
    implStatus: plan.impl?.frontmatter.status as string | undefined,
    position: plan.position?.position,
    waitingOn: waiting?.on,
  });
  const checkout = plan.worktree?.path ?? projectPath;
  const parts = await readPlanParts(checkout, name, {
    archived: plan.archived || Boolean(plan.archivedInWorktree),
    health: await readPlanHealth(projectPath, checkout),
  });
  const documents = planDocuments(plan);
  const brief = documents.find((d) => d.slug === "brief");
  const research = documents.find((d) => d.slug === "research");
  const planHref = `/p/${project}/plan/${name}`;
  // The brief can be talked over whenever the plan has a worktree or code to
  // work in — before approval to write it, after to amend it, which waits on
  // the person as any amendment does.
  const canTalk =
    !plan.archived && (plan.worktree !== undefined || plan.code !== undefined);

  return (
    <>
      <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
      <FollowAgent />
      <div className="cols-brief-page grid items-start gap-5">
        <PlanFrame
          project={project}
          plan={plan}
          lookState={briefLookState(plan.impl?.frontmatter, parts.hasBriefFile)}
        >
          <TrustNotice
            project={project}
            trusted={projectTrusted(projectPath)}
          />
          <nav className="flex gap-4 text-sm text-ink-soft">
            <a href={planHref}>Plan</a>
            {research ? (
              <a href={`${planHref}/doc/research`}>Research</a>
            ) : null}
          </nav>
          {parts.description ? (
            <p className="text-ink-soft" data-testid="plan-description">
              {parts.description}
            </p>
          ) : null}
          <div className="grid gap-2" data-testid="plan-parts">
            <PlanParts
              parts={parts}
              zeroWithoutBrief
              looksHref={`/p/${project}/looks?${plan.worktree ? `checkout=${encodeURIComponent(name)}` : ""}`}
            />
          </div>
          <article
            className="grid gap-4"
            data-testid="plan-document-page"
            data-document="brief"
          >
            {brief ? (
              <Markdown>{brief.content}</Markdown>
            ) : (
              <p className="text-sm text-ink-faint">
                No brief yet. Ask the agent to write it.
              </p>
            )}
          </article>
        </PlanFrame>
        <WindowColumn
          className="gap-2 border-l border-line pt-2 pb-6 pl-4"
          data-testid="brief-agent"
        >
          <h2 className="font-display text-lg font-bold">Agent</h2>
          {canTalk ? null : (
            <p className="text-sm text-ink-faint">
              The agent works in the plan's worktree; this plan has none.
            </p>
          )}
          <PlanSession
            project={project}
            plan={name}
            canApprove={actions.canApprove}
            canPlan={canTalk}
            approvedHref={planHref}
            fill
          />
        </WindowColumn>
      </div>
    </>
  );
}
