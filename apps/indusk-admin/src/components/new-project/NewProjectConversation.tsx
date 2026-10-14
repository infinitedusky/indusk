"use client";

import type { TranscriptLine } from "@infinitedusky/indusk-mcp/new-project";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  type KnowledgeItem,
  KnowledgeList,
} from "@/components/ui/KnowledgeList";
import { Message } from "@/components/ui/Message";
import { historyBefore } from "@/lib/conversation-turns";
import { postJson } from "@/lib/post-json";
import { ownsSession, type RunningSession } from "@/lib/session-owner";
import { ConversationThread } from "./ConversationThread";
import { readFiles } from "./documents";
import { useProjectSession } from "./use-project-session";

/** The session record's project for a conversation that is in no project (`NEW_PROJECT_SESSION_PROJECT`). */
const SESSION_PROJECT = "new-project";

/**
 * A project conversation (new-project-flow, the approved
 * `new-project.conversation`): the person's first words and documents, the
 * agent's replies as a thread (`ConversationThread`: Markdown, the working
 * folded behind "See more"), and what the agent knows so far. Leaving now keeps the draft; Discard removes it
 * and everything it held. Nothing is on disk outside the draft.
 *
 * promise: a-project-starts-as-a-conversation
 */
export function NewProjectConversation({
  draft,
  sessionPlan,
  message,
  documents,
  knowledge,
  hasContent,
  transcript = [],
  initiallyOpen = false,
  session: startedSession = null,
}: {
  draft: string;
  /** The `plan` the draft's session record names (`newProjectSessionPlan`). */
  sessionPlan: string;
  message: string;
  documents: string[];
  knowledge: KnowledgeItem[];
  /** The agent has written a brief or a proposal: the conversation is reopened, not begun. */
  hasContent: boolean;
  /** What the conversation has said so far, from the draft's `transcript.jsonl`. */
  transcript?: TranscriptLine[];
  /** Every reply starts with its working shown. */
  initiallyOpen?: boolean;
  /**
   * The draft's session when the page was drawn: Start launched it, so the
   * conversation opens on the thread with the agent working. The button below
   * stays only for a conversation whose agent is not running.
   */
  session?: string | null;
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(startedSession);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useProjectSession(sessionId);

  useEffect(() => {
    let live = true;
    void fetch("/api/sessions")
      .then((r) => r.json())
      .then((body: { session: RunningSession | null }) => {
        if (
          live &&
          ownsSession(body.session, SESSION_PROJECT, sessionPlan, "planning")
        )
          setSessionId(body.session.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionPlan]);

  /** Start the conversation again; `text` rides in the first message when the person is replying. */
  const reopen = async (text?: string) => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>(
      `/api/new-projects/${draft}/talk`,
      { reopened: hasContent, ...(text ? { text } : {}) },
    );
    setBusy(false);
    if (!r.ok || !r.body.id) {
      setProblem(r.ok ? "the admin started no conversation" : r.error);
      return;
    }
    setSessionId(r.body.id);
  };

  const addDocuments = async (files: FileList | null) => {
    if (!files) return;
    setProblem(null);
    for (const file of await readFiles(Array.from(files))) {
      const r = await postJson<{ replaced?: boolean; told?: boolean }>(
        `/api/new-projects/${draft}/add`,
        file,
      );
      if (!r.ok) {
        setProblem(r.error);
        return;
      }
      setNote(
        r.body.replaced
          ? `${file.name} was replaced by the newer version${r.body.told ? " and the agent was told what changed" : ""}.`
          : `${file.name} was added.`,
      );
    }
    router.refresh();
  };

  const discard = async () => {
    setProblem(null);
    const r = await postJson(`/api/new-projects/${draft}/discard`, {});
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    router.push("/");
  };

  const history = historyBefore(transcript, sessionId);
  const threaded = sessionId !== null || history.length > 0;
  const addButton = (
    <Button variant="ghost" size="sm" onClick={() => picker.current?.click()}>
      + Add a document
    </Button>
  );

  return (
    <div className="cols-conversation grid items-start gap-5">
      <section className="grid min-w-0 gap-3">
        <Message state="you" documents={documents}>
          <p className="whitespace-pre-wrap">{message}</p>
        </Message>
        {threaded ? (
          <ConversationThread
            events={[...history, ...session.events]}
            running={session.running}
            onAnswer={session.answer}
            onDecide={session.decide}
            onSay={(text) =>
              sessionId && session.running
                ? session.say(text)
                : void reopen(text)
            }
            onStop={session.stop}
            initiallyOpen={initiallyOpen}
            onFoldOpened={() =>
              void postJson(`/api/new-projects/${draft}/fold`, {})
            }
            actions={addButton}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void reopen()} disabled={busy}>
              {hasContent ? "Reopen the conversation" : "Talk to the agent"}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {threaded ? null : addButton}
          <Button variant="ghost" size="sm" onClick={() => void discard()}>
            Discard
          </Button>
        </div>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label="Add a document"
          onChange={(e) => {
            void addDocuments(e.target.files);
            e.target.value = "";
          }}
        />
        {note ? <p className="text-sm text-ink-soft">{note}</p> : null}
        {problem || session.problem ? (
          <p className="text-sm text-bad">{problem ?? session.problem}</p>
        ) : null}
      </section>
      <aside className="grid gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-2xs leading-1 font-semibold tracking-caps text-ink-faint uppercase">
          What the agent knows
        </p>
        <KnowledgeList items={knowledge} />
        <p className="text-sm leading-3 text-ink-faint">
          When these are settled the agent proposes the project. Leave now and
          the conversation is kept as a draft; nothing is on disk.
        </p>
      </aside>
    </div>
  );
}
