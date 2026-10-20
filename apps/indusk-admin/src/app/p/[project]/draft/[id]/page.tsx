import { draftHomeOf, readDraftView } from "@infinitedusky/indusk-mcp/drafts";
import { draftSessionPlan } from "@infinitedusky/indusk-mcp/session";
import { readWorkbenchRepos } from "@infinitedusky/indusk-mcp/worktree/repos";
import { notFound } from "next/navigation";
import { DraftConversation } from "@/components/drafts/DraftConversation";
import { DraftParts } from "@/components/drafts/DraftParts";
import { DraftProposal } from "@/components/drafts/DraftProposal";
import { Tag } from "@/components/ui/Tag";
import { startPage } from "@/lib/page-reads";
import { getProjectPath } from "@/lib/registry-client";

interface DraftPageProps {
  params: Promise<{ project: string; id: string }>;
}

/**
 * `/p/{project}/draft/{id}` — a conversation not yet kept as a plan
 * (brief-as-the-contract, ADR decision 6), drawn as the approved `plan.new`
 * draws it: a crumb, "New plan", and the box to tell the agent what you want.
 * Beneath it, as the agent writes them, the promises, expectations and looks
 * so far, and the proposal to accept or edit. The draft lives in the project's
 * home; this page reads it through the package and writes nothing.
 *
 * promise: a-plan-starts-as-a-conversation
 */
export default async function DraftPage({ params }: DraftPageProps) {
  const { project, id } = await params;
  const root = getProjectPath(project);
  const page = startPage("draft", root ?? "");
  if (!root) notFound();
  const view = readDraftView(draftHomeOf(root), id);
  if (!view) notFound();
  const repos = readWorkbenchRepos(root).map((r) => r.name);
  page.finish(0);

  return (
    <article className="grid gap-5" data-testid="draft-page" data-draft={id}>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 pb-hair pt-5">
        <div>
          <div className="text-sm leading-3 text-ink-faint">
            <b className="font-medium text-ink-soft">{project}</b> / Plans / New
          </div>
          <h1 className="font-display text-4xl font-bold leading-7">
            {view.proposal?.name ?? "New plan"}
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Tag data-testid="draft-tag">draft · {view.age}</Tag>
        </div>
      </header>
      <DraftConversation
        project={project}
        draft={id}
        sessionPlan={draftSessionPlan(id)}
        hasContent={view.hasBrief || view.hasResearch}
      />
      <DraftParts view={view} />
      {view.proposal ? (
        <DraftProposal
          // Re-keyed by the proposal, so the agent proposing again resets the fields.
          key={`${view.proposal.name}:${view.proposal.type}`}
          project={project}
          draft={id}
          proposal={view.proposal}
          repos={repos}
        />
      ) : null}
    </article>
  );
}
