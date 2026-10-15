"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * New plan (brief-as-the-contract, ADR decision 6): the entry to a
 * conversation. It asks for nothing — no name, no type, no repo — opens an
 * empty draft in the project's home and moves to it; the agent proposes a name
 * and type once what the plan promises and how it looks are clear, and the
 * person accepts them there (`DraftProposal`).
 *
 * promise: a-plan-starts-as-a-conversation
 */
export function NewPlanForm({ project }: { project: string }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>("/api/drafts", { project });
    setBusy(false);
    if (!r.ok || !r.body.id) {
      setProblem(r.ok ? "the admin opened no conversation" : r.error);
      return;
    }
    router.push(`/p/${project}/draft/${r.body.id}`);
  };

  return (
    <div className="flex flex-col gap-2 text-left text-sm">
      <Button disabled={busy} onClick={() => void begin()}>
        {busy ? "Opening…" : "New plan"}
      </Button>
      <p className="text-ink-faint">
        Nothing is asked first: talk to the agent, and accept the name it
        proposes.
      </p>
      {problem ? <p className="text-bad">{problem}</p> : null}
    </div>
  );
}
