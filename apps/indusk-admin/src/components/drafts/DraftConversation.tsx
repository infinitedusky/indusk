"use client";

import { useEffect, useState } from "react";
import { SessionConnector } from "@/components/session/SessionConnector";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";
import {
  ownsSession,
  type RunningSession,
  sessionUrl,
} from "@/lib/session-owner";

/**
 * A draft's conversation (brief-as-the-contract, ADR decision 6): a box to tell
 * the agent what you want, nothing asked first, and — once talking — the
 * session itself. A draft that already holds something is reopened rather than
 * begun. The agent works in the draft's own folder, outside the repository.
 *
 * promise: a-plan-starts-as-a-conversation
 */
export function DraftConversation({
  project,
  draft,
  sessionPlan,
  hasContent,
}: {
  project: string;
  draft: string;
  /** The `plan` the draft's session record names (`draftSessionPlan`). */
  sessionPlan: string;
  /** The draft already holds a brief or research: it is reopened, not begun. */
  hasContent: boolean;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch(sessionUrl(project, sessionPlan, "planning"))
      .then((r) => r.json())
      .then((body: { session: RunningSession | null }) => {
        if (live && ownsSession(body.session, project, sessionPlan, "planning"))
          setSessionId(body.session.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [project, sessionPlan]);

  const talk = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>(`/api/drafts/${draft}/talk`, {
      project,
      text,
      reopened: hasContent,
    });
    setBusy(false);
    if (!r.ok || !r.body.id) {
      setProblem(r.ok ? "the admin started no conversation" : r.error);
      return;
    }
    setSessionId(r.body.id);
  };

  if (sessionId) return <SessionConnector sessionId={sessionId} />;
  return (
    <section className="grid gap-4">
      {hasContent ? null : (
        <h2 className="font-display text-3xl leading-7 font-bold">
          What do you want to build?
        </h2>
      )}
      <textarea
        aria-label="Tell the agent what you want"
        className="min-h-input w-full resize-y rounded-xl border border-line bg-surface p-4 text-ink"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-sm leading-3 text-ink-faint">
        Nothing is asked first. The agent proposes a name once what it promises
        and how it looks are clear, and you accept it.
      </p>
      <div className="flex flex-wrap gap-snug">
        <Button
          onClick={() => void talk()}
          disabled={busy || (!hasContent && text.trim() === "")}
        >
          {hasContent ? "Reopen the conversation" : "Talk to the agent"}
        </Button>
      </div>
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
    </section>
  );
}
