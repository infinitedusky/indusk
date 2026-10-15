"use client";

import type { Proposal } from "@infinitedusky/indusk-mcp/new-project";
import { creationStepIds } from "@infinitedusky/indusk-mcp/new-project/steps";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { postJson } from "@/lib/post-json";
import { NewProjectCreatingPanel } from "./NewProjectCreatingPanel";
import { NewProjectProposal } from "./NewProjectProposal";

/**
 * The proposal of draft `draft`, with the network its buttons need: Create
 * keeps the person's edits (the package checks them and may refuse) and then
 * asks for the project to be made; Keep talking goes back to the conversation.
 * Nothing is made until Create, and nothing but the draft is written before.
 *
 * promise: a-project-starts-as-a-conversation
 */
export function NewProjectProposalPanel({
  draft,
  proposal,
  documents,
  briefView,
  githubAccount,
}: {
  draft: string;
  proposal: Proposal;
  documents: readonly string[];
  briefView?: ReactNode;
  githubAccount: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [creating, setCreating] = useState<Proposal | null>(null);

  const create = async (edited: Proposal) => {
    setBusy(true);
    setProblem(null);
    const saved = await postJson<{ proposal: Proposal }>(
      `/api/new-projects/${draft}/proposal`,
      edited,
    );
    if (!saved.ok) {
      setBusy(false);
      setProblem(saved.error);
      return;
    }
    setBusy(false);
    setCreating(saved.body.proposal);
  };

  if (creating) {
    return (
      <NewProjectCreatingPanel
        draft={draft}
        proposal={creating}
        name={creating.name}
        location={creating.location}
        stepIds={creationStepIds(creating.remote.github)}
        onBack={() => {
          window.history.replaceState(null, "", `/new/${draft}`);
          setCreating(null);
        }}
      />
    );
  }

  return (
    <>
      <header>
        <div className="text-sm leading-3 text-ink-faint">
          <b className="font-medium text-ink-soft">Projects</b> / New
        </div>
        <h1 className="font-display text-4xl leading-7 font-bold">
          {proposal.name}
        </h1>
        <p className="text-sm leading-3 text-ink-faint">
          The agent's proposal. Change anything, then create it.
        </p>
      </header>
      <NewProjectProposal
        proposal={proposal}
        documents={documents}
        briefView={briefView}
        githubAccount={githubAccount}
        busy={busy}
        problem={problem}
        onCreate={(edited) => void create(edited)}
        onKeepTalking={() => router.push(`/new/${draft}?talk=1`)}
      />
    </>
  );
}
