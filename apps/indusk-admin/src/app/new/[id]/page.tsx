import {
  githubAccount,
  induskHome,
  knowledgeOf,
  loadProposal,
  NEW_PROJECT_SESSION_PROJECT,
  newProjectSessionPlan,
  type Proposal,
  readCreation,
  readProjectDraft,
  readTranscript,
  type TranscriptLine,
} from "@infinitedusky/indusk-mcp/new-project";
import { creationStepIds } from "@infinitedusky/indusk-mcp/new-project/steps";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { NewProjectConversation } from "@/components/new-project/NewProjectConversation";
import { NewProjectCreatingPanel } from "@/components/new-project/NewProjectCreatingPanel";
import { NewProjectProposalPanel } from "@/components/new-project/NewProjectProposalPanel";
import { agentState, historyBefore, turnsOf } from "@/lib/conversation-turns";
import { sessionManager } from "@/lib/session-host";
import { ownsSession } from "@/lib/session-owner";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    talk?: string;
    creating?: string;
    open?: string;
    working?: string;
    github?: string;
  }>;
}

/** The look states the proposal draws: the screen, and each component it places. */
const proposalLookStates = (
  proposal: Proposal,
  withDocuments: boolean,
  signedIn: boolean,
): string =>
  [
    signedIn ? "new-project.proposal" : "new-project.github-signed-out",
    "layout-tree.default",
    "workflow-strip.default",
    ...(proposal.recommendations.some((r) => r.kept)
      ? ["recommendation.kept"]
      : []),
    ...(proposal.recommendations.some((r) => !r.kept)
      ? ["recommendation.declined"]
      : []),
    ...(withDocuments ? ["file-chip.default"] : []),
  ].join(" ");

/** The look states this page draws: the screen, and each component it places in the states its turns are in. */
const lookStates = (
  withDocuments: boolean,
  replies: readonly string[],
): string =>
  [
    "new-project.conversation",
    "message.you",
    ...replies.map((state) => `message.${state}`),
    ...(withDocuments ? ["file-chip.default"] : []),
    "knowledge-list.default",
  ].join(" ");

/** The message states the thread draws for the transcript's turns, each once, in the order first met. */
const replyLookStates = (
  transcript: readonly TranscriptLine[],
  { open, running }: { open: boolean; running: boolean },
): string[] => {
  const turns = turnsOf(historyBefore(transcript, null), { running });
  return [
    ...new Set(
      turns.flatMap((t) => (t.who === "agent" ? [agentState(t, open)] : [])),
    ),
  ];
};

/**
 * `/new/{id}` - a project conversation (new-project-flow), drawn as the
 * approved `new-project.conversation` draws it: the person's words and
 * documents, the agent's session, and what the agent knows so far. Once the
 * agent has written a proposal that holds, the page is that proposal
 * (`new-project.proposal`) until the person chooses to keep talking. The draft
 * lives under the InDusk home; this page reads it through the package and
 * writes nothing.
 *
 * promise: a-project-starts-as-a-conversation
 */
export default async function NewProjectConversationPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { talk, creating, open, working, github } = await searchParams;
  const draft = readProjectDraft(induskHome(), id);
  if (!draft) notFound();
  const { proposal, problems } = draft.hasProposal
    ? loadProposal(draft)
    : { proposal: null, problems: [] };
  const creation =
    proposal && creating !== undefined ? readCreation(draft) : null;
  if (proposal && creation) {
    return (
      <main
        className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
        data-draft={id}
      >
        <NewProjectCreatingPanel
          draft={id}
          proposal={proposal}
          name={proposal.name}
          location={proposal.location}
          stepIds={creationStepIds(proposal.remote.github)}
          initial={creation.steps}
          initialProblem={creation.error ?? null}
          start={false}
          backHref={`/new/${id}`}
        />
      </main>
    );
  }
  if (proposal && talk === undefined) {
    // `?github=signed-out` only ever turns the offer off: it is how the looks
    // check reaches `new-project.github-signed-out` on a machine that is signed in.
    const account = github === "signed-out" ? null : await githubAccount();
    return (
      <main
        className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
        data-look-state={proposalLookStates(
          proposal,
          draft.documents.length > 0,
          account !== null,
        )}
        data-draft={id}
      >
        <NewProjectProposalPanel
          draft={id}
          proposal={proposal}
          documents={draft.documents}
          githubAccount={account}
          briefView={
            draft.brief ? <Markdown>{draft.brief}</Markdown> : undefined
          }
        />
      </main>
    );
  }
  const transcript = readTranscript(draft);
  const running = sessionManager().current();
  const session = ownsSession(
    running,
    NEW_PROJECT_SESSION_PROJECT,
    newProjectSessionPlan(id),
    "planning",
  )
    ? running.id
    : null;
  return (
    <main
      className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
      data-look-state={lookStates(
        draft.documents.length > 0,
        replyLookStates(transcript, {
          open: open !== undefined,
          running: working !== undefined,
        }),
      )}
      data-draft={id}
    >
      <header>
        <div className="text-sm leading-3 text-ink-faint">
          <b className="font-medium text-ink-soft">Projects</b> / New
        </div>
        <h1 className="font-display text-4xl leading-7 font-bold">
          New project
        </h1>
        {proposal ? (
          <Link
            href={`/new/${id}`}
            className="text-sm leading-3 text-ink-soft underline"
          >
            Back to the proposal
          </Link>
        ) : null}
        {problems.length > 0 ? (
          <p className="text-sm leading-3 text-bad">
            The agent's proposal cannot be used yet: {problems.join("; ")}.
          </p>
        ) : null}
      </header>
      <NewProjectConversation
        draft={id}
        sessionPlan={newProjectSessionPlan(id)}
        message={draft.message}
        documents={draft.documents}
        knowledge={knowledgeOf(draft)}
        hasContent={draft.brief !== null || draft.hasProposal}
        transcript={transcript}
        initiallyOpen={open !== undefined}
        session={session}
        showRunning={working !== undefined}
      />
    </main>
  );
}
