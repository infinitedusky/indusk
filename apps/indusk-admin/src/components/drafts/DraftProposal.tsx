"use client";

import { WORKFLOW_TYPES } from "@infinitedusky/indusk-mcp/workflow-types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * The agent's proposed name and type for a draft, with Accept and Edit
 * (brief-as-the-contract, ADR decision 6): the person accepts or edits every
 * proposal at the moment it is made. Accepting makes the plan on its own
 * branch and worktree with the draft as its brief, and the page moves to it. A
 * name already taken is refused and another is asked for. In a workbench that
 * wraps more than one repo, accepting also says which repo the plan's code goes
 * in.
 *
 * promise: a-plan-starts-as-a-conversation
 */
export function DraftProposal({
  project,
  draft,
  proposal,
  repos = [],
}: {
  project: string;
  draft: string;
  proposal: { name: string; type: string; repo?: string };
  /** The workbench's declared repos; empty in a normal-mode project. */
  repos?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(proposal.name);
  const [type, setType] = useState(proposal.type);
  const asksRepo = repos.length > 1;
  const [repo, setRepo] = useState(proposal.repo ?? repos[0] ?? "");
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ plan?: string; type?: string }>(
      `/api/drafts/${draft}/accept`,
      {
        project,
        name,
        type,
        ...(asksRepo ? { repo } : {}),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      setEditing(true);
      return;
    }
    // A spike has no brief (a draft with none becomes one), so it lands on the
    // plan's page, where its research is.
    const page = (r.body.type ?? type) === "spike" ? "" : "/brief";
    router.push(`/p/${project}/plan/${r.body.plan}${page}`);
  };

  const editable = editing || asksRepo;
  return (
    <section
      className="grid gap-3 rounded-xl border border-line bg-surface p-5"
      data-testid="draft-proposal"
    >
      <h2 className="font-display text-lg leading-4 font-bold">
        The agent proposes
      </h2>
      {editable ? (
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-ink-soft">Name</span>
            <input
              className="rounded-md border border-line px-2 py-1 font-mono"
              value={name}
              placeholder="kebab-case-name"
              onChange={(e) => setName(e.target.value.trim())}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-ink-soft">Type</span>
            <select
              className="rounded-md border border-line px-2 py-1"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {WORKFLOW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {asksRepo ? (
            <label className="grid gap-1">
              <span className="text-ink-soft">Repo</span>
              <select
                className="rounded-md border border-line px-2 py-1"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              >
                {repos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-3">
          <b className="font-mono font-medium">{name}</b>
          <span className="text-ink-faint"> · {type}</span>
        </p>
      )}
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
      <div className="flex flex-wrap gap-snug">
        <Button
          onClick={() => void accept()}
          disabled={busy || !/^[a-z0-9][a-z0-9-]*$/.test(name)}
        >
          {busy ? "Starting…" : "Accept"}
        </Button>
        {editable ? null : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    </section>
  );
}
