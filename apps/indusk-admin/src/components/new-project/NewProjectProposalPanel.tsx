"use client";

import type { Proposal } from "@infinitedusky/indusk-mcp/new-project";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { postJson } from "@/lib/post-json";
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
}: {
  draft: string;
  proposal: Proposal;
  documents: readonly string[];
  briefView?: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const create = async (edited: Proposal) => {
    setBusy(true);
    setProblem(null);
    const saved = await postJson(`/api/new-projects/${draft}/proposal`, edited);
    if (!saved.ok) {
      setBusy(false);
      setProblem(saved.error);
      return;
    }
    const made = await postJson(`/api/new-projects/${draft}/accept`, {});
    setBusy(false);
    if (!made.ok) setProblem(made.error);
  };

  return (
    <NewProjectProposal
      proposal={proposal}
      documents={documents}
      briefView={briefView}
      busy={busy}
      problem={problem}
      onCreate={(edited) => void create(edited)}
      onKeepTalking={() => router.push(`/new/${draft}?talk=1`)}
    />
  );
}
