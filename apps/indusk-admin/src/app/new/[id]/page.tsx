import {
  induskHome,
  knowledgeOf,
  newProjectSessionPlan,
  readProjectDraft,
} from "@infinitedusky/indusk-mcp/new-project";
import { notFound } from "next/navigation";
import { NewProjectConversation } from "@/components/new-project/NewProjectConversation";

interface Props {
  params: Promise<{ id: string }>;
}

/** The look states this page draws: the screen, and each component it places in its default state. */
const lookStates = (withDocuments: boolean): string =>
  [
    "new-project.conversation",
    "message.you",
    ...(withDocuments ? ["file-chip.default"] : []),
    "knowledge-list.default",
  ].join(" ");

/**
 * `/new/{id}` - a project conversation (new-project-flow), drawn as the
 * approved `new-project.conversation` draws it: the person's words and
 * documents, the agent's session, and what the agent knows so far. The draft
 * lives under the InDusk home; this page reads it through the package and
 * writes nothing.
 *
 * promise: a-project-starts-as-a-conversation
 */
export default async function NewProjectConversationPage({ params }: Props) {
  const { id } = await params;
  const draft = readProjectDraft(induskHome(), id);
  if (!draft) notFound();
  return (
    <main
      className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
      data-look-state={lookStates(draft.documents.length > 0)}
      data-draft={id}
    >
      <header>
        <div className="text-sm leading-3 text-ink-faint">
          <b className="font-medium text-ink-soft">Projects</b> / New
        </div>
        <h1 className="font-display text-4xl leading-7 font-bold">
          New project
        </h1>
      </header>
      <NewProjectConversation
        draft={id}
        sessionPlan={newProjectSessionPlan(id)}
        message={draft.message}
        documents={draft.documents}
        knowledge={knowledgeOf(draft)}
        hasContent={draft.brief !== null || draft.hasProposal}
      />
    </main>
  );
}
