"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DraftRow } from "@/components/ui/DraftRow";
import { postJson } from "@/lib/post-json";

export interface DraftListRow {
  id: string;
  title: string;
  age: string;
  aged: boolean;
}

/**
 * The conversations a project has not kept (brief-as-the-contract): each a
 * `DraftRow` with Reopen and Discard. A draft lives in the project's home, so
 * discarding one touches nothing in a checkout.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 */
export function DraftList({
  project,
  drafts,
}: {
  project: string;
  drafts: DraftListRow[];
}) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);

  const discard = async (id: string) => {
    setProblem(null);
    const r = await postJson(`/api/drafts/${id}/discard`, { project });
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    router.refresh();
  };

  if (drafts.length === 0) return null;
  return (
    <section className="grid gap-snug text-left" data-testid="draft-list">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 className="font-display text-lg leading-4 font-bold">Drafts</h2>
        <span className="font-mono text-xs leading-2 text-ink-faint">
          {drafts.length} conversation{drafts.length === 1 ? "" : "s"} not kept
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {drafts.map((d) => (
          <DraftRow
            key={d.id}
            data-draft={d.id}
            title={d.title}
            age={d.age}
            aged={d.aged}
            onReopen={() => router.push(`/p/${project}/draft/${d.id}`)}
            onDiscard={() => void discard(d.id)}
          />
        ))}
      </div>
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
    </section>
  );
}
