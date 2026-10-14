"use client";

import type { Proposal } from "@infinitedusky/indusk-mcp/new-project";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileChip } from "@/components/ui/FileChip";
import { LayoutTree } from "@/components/ui/LayoutTree";
import { Recommendation } from "@/components/ui/Recommendation";
import { WorkflowStrip } from "@/components/ui/WorkflowStrip";
import {
  decline,
  keep,
  layoutOf,
  titleOf,
  workflowDocuments,
} from "./proposal-edit";

const field =
  "rounded-md border border-line bg-surface px-2 py-1 font-mono text-sm text-ink";

/**
 * The agent's proposal (new-project-flow, the approved `new-project.proposal`):
 * the name, location and shape of the project, how it will plan, each practice
 * the agent recommends with Decline, the founding brief, the private GitHub
 * repository as its own confirm, and Create project. Every field is the
 * person's to change before accepting; nothing is made until Create.
 *
 * What a valid proposal is stays the package's: Create hands the edited
 * proposal on and the refusal, if there is one, comes back as `problem`.
 *
 * The private GitHub repository opens unticked whatever the proposal says, so
 * only the person's tick creates one.
 *
 * promise: a-new-project-publishes-nothing-unasked
 * promise: a-project-starts-as-a-conversation
 */
export function NewProjectProposal({
  proposal,
  documents = [],
  briefView,
  onCreate,
  onKeepTalking,
  busy = false,
  problem = null,
}: {
  proposal: Proposal;
  /** The documents the person gave, by name. */
  documents?: readonly string[];
  /** The founding brief, drawn by the page (markdown is rendered only by `<Markdown>`). */
  briefView?: ReactNode;
  onCreate?: (proposal: Proposal) => void;
  onKeepTalking?: () => void;
  busy?: boolean;
  problem?: string | null;
}) {
  // The GitHub repository is the person's to tick: whatever the agent wrote,
  // the box opens unticked (a-new-project-publishes-nothing-unasked).
  const [edited, setEdited] = useState<Proposal>({
    ...proposal,
    remote: { github: false },
  });
  const [reposText, setReposText] = useState(
    proposal.repos.map((r) => r.name).join(", "),
  );
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reading, setReading] = useState(false);

  const setRepos = (text: string) => {
    setReposText(text);
    setEdited((p) => ({
      ...p,
      repos: text
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((name) => ({ name })),
    }));
  };

  const confirmDecline = (name: string) => {
    setEdited((p) => decline(p, name, reason.trim()));
    setDeclining(null);
    setReason("");
  };

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-2xs leading-1 font-semibold tracking-caps text-ink-faint uppercase">
          Where and what shape
        </p>
        <label className="grid gap-1 text-sm leading-3 text-ink-faint">
          Name
          <input
            className={field}
            value={edited.name}
            onChange={(e) =>
              setEdited((p) => ({ ...p, name: e.target.value.trim() }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm leading-3 text-ink-faint">
          Location
          <input
            className={field}
            value={edited.location}
            onChange={(e) =>
              setEdited((p) => ({ ...p, location: e.target.value.trim() }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm leading-3 text-ink-faint">
          Repositories
          <input
            className={field}
            value={reposText}
            onChange={(e) => setRepos(e.target.value)}
          />
        </label>
        <LayoutTree>{layoutOf(edited)}</LayoutTree>
      </section>

      <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-2xs leading-1 font-semibold tracking-caps text-ink-faint uppercase">
          How you'll plan
        </p>
        <WorkflowStrip documents={workflowDocuments(edited.documentsOff)} />
        <p className="text-sm leading-3 text-ink-faint">
          A brief with promises and a test plan are always kept — they are how
          you know the project does what you asked.
          {edited.documentsOff.length > 0
            ? " The rest are off where you declined them."
            : ""}
        </p>
      </section>

      <section className="grid gap-3">
        <p className="text-2xs leading-1 font-semibold tracking-caps text-ink-faint uppercase">
          What building it properly takes
        </p>
        <ul className="grid gap-2">
          {edited.recommendations.map((rec) => (
            <Recommendation
              key={rec.name}
              state={rec.kept ? "kept" : "declined"}
              title={titleOf(rec)}
              why={rec.why}
              reason={rec.reason}
              action={
                rec.kept ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDeclining(rec.name);
                      setReason("");
                    }}
                  >
                    Decline
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEdited((p) => keep(p, rec.name))}
                  >
                    Keep it after all
                  </Button>
                )
              }
            >
              {declining === rec.name ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className={`${field} grow`}
                    aria-label={`Why decline ${titleOf(rec)}?`}
                    placeholder="Your reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={reason.trim() === ""}
                    onClick={() => confirmDecline(rec.name)}
                  >
                    Confirm decline
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeclining(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
            </Recommendation>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-2xs leading-1 font-semibold tracking-caps text-ink-faint uppercase">
          Founding brief
        </p>
        <p>
          Written from this conversation
          {documents.length > 0 ? " and " : ""}
          {documents.map((name) => (
            <FileChip key={name}>{name}</FileChip>
          ))}
          . Its {edited.milestones.length} milestones become the master plan
          {documents.length > 0
            ? "; your documents are kept unchanged beside it"
            : ""}
          .
        </p>
        {briefView ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReading((r) => !r)}
            >
              {reading ? "Hide the brief" : "Read the brief"}
            </Button>
          </div>
        ) : null}
        {reading ? briefView : null}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <label className="flex items-start gap-3 text-sm leading-3 text-ink-soft">
          <input
            type="checkbox"
            checked={edited.remote.github}
            onChange={(e) =>
              setEdited((p) => ({ ...p, remote: { github: e.target.checked } }))
            }
          />
          <span>
            Also create a <b>private</b> GitHub repository for{" "}
            <span className="font-mono text-xs text-ink-faint">
              {edited.repos[0]?.name ?? edited.name}
            </span>
            . This is the only step that sends anything off this machine.
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={() => onCreate?.(edited)}>
          {busy ? "Creating…" : "Create project"}
        </Button>
        <Button variant="secondary" onClick={onKeepTalking}>
          Keep talking
        </Button>
      </div>
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
    </div>
  );
}
