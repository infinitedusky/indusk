import { readPlanParts } from "@infinitedusky/indusk-mcp/plans/parts";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/LiveRefresh";
import { Markdown } from "@/components/Markdown";
import { PlanFrame } from "@/components/plan/PlanFrame";
import { PlanParts } from "@/components/plan/PlanParts";
import { FollowAgent } from "@/components/session/FollowAgent";
import { PlanSession } from "@/components/session/PlanSession";
import { TrustNotice } from "@/components/session/TrustNotice";
import { planActions } from "@/lib/plan-actions";
import { planDocuments } from "@/lib/plan-parts-view";
import { readActivePlans, readArchivedPlans } from "@/lib/planning-reader";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";
import { projectTrusted } from "@/lib/trust-reader";

interface BriefPageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * `/p/{project}/plan/{name}/brief` — where a plan is written: its promises,
 * expectations and looks and the brief itself on the right, the agent the
 * person writes it with in a column on the left. A draft's accepted name
 * lands here; Approve moves to the plan's page, where Build starts the build.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export default async function PlanBriefPage({ params }: BriefPageProps) {
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
  if (!plan) notFound();

  const actions = planActions({
    worktree: plan.worktree,
    code: plan.code,
    implStatus: plan.impl?.frontmatter.status as string | undefined,
    position: plan.position?.position,
  });
  const checkout = plan.worktree?.path ?? projectPath;
  const parts = await readPlanParts(checkout, name, {
    archived: plan.archived || Boolean(plan.archivedInWorktree),
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
      <PlanFrame project={project} plan={plan}>
        <TrustNotice project={project} trusted={projectTrusted(projectPath)} />
        <nav className="flex gap-4 text-sm text-ink-soft">
          <a href={planHref}>Plan</a>
          {research ? <a href={`${planHref}/doc/research`}>Research</a> : null}
        </nav>
        <div className="cols-brief-page grid items-start gap-5">
          <aside
            className="sticky top-0 flex max-h-screen min-w-0 flex-col gap-2 self-start overflow-y-auto py-2"
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
            />
          </aside>
          <div className="grid min-w-0 gap-4">
            {parts.description ? (
              <p className="text-ink-soft" data-testid="plan-description">
                {parts.description}
              </p>
            ) : null}
            <div className="grid gap-2" data-testid="plan-parts">
              <PlanParts
                parts={parts}
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
          </div>
        </div>
      </PlanFrame>
    </>
  );
}
