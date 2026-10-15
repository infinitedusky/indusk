"use client";

import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import type { ReactNode } from "react";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { EventView, type Replied } from "@/components/session/SessionPanel";
import { useAnsweredRequests } from "@/components/session/use-answered-requests";
import { Button } from "@/components/ui/Button";
import { Message } from "@/components/ui/Message";
import { agentState, type Turn, turnsOf } from "@/lib/conversation-turns";

/**
 * A project conversation as a thread (new-project-flow, ADR decision 9): the
 * session's events read by `turnsOf` as the person's words and the agent's
 * replies, each reply in Markdown with its working folded behind "See more".
 * A question or permission the agent waits on is answered in place and is
 * never folded - it waits on the person. The reply box sends through the
 * session's `say`. The shared session panel is unchanged; the plan
 * conversation, builds and Fix with Claude still use it.
 *
 * promise: a-project-conversation-is-a-back-and-forth
 */
export function ConversationThread({
  events,
  running,
  onAnswer,
  onDecide,
  onSay,
  onStop,
  onFoldOpened,
  initiallyOpen = false,
  actions,
}: {
  events: readonly StartedEvent[];
  /** An agent is running: what it waits on can be answered, and it can be stopped. */
  running: boolean;
  onAnswer: (requestId: string, answers: Record<string, string>) => Replied;
  onDecide: (requestId: string, allow: boolean) => Replied;
  /** Reply in the person's own words; absent, the thread offers no reply box. */
  onSay?: (text: string) => void;
  onStop?: () => void;
  /** "See more" was used on a reply: the page records that the working was read. */
  onFoldOpened?: () => void;
  /** Every reply starts with its working shown. */
  initiallyOpen?: boolean;
  /** What sits beside Send in the reply box's row (attaching a document). */
  actions?: ReactNode;
}) {
  const { answered, settle } = useAnsweredRequests();
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState("");
  const send = () => {
    if (!onSay || !draft.trim()) return;
    onSay(draft);
    setDraft("");
  };
  const turns = turnsOf(events, { answered, running });
  const toggle = (at: number, open: boolean) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(at)) next.delete(at);
      else next.add(at);
      return next;
    });
    if (!open) onFoldOpened?.();
  };

  return (
    <div className="grid gap-3" data-testid="conversation-thread">
      {turns.map((turn, at) => (
        // Turns are append-only; position is identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: an append-only thread
        <div key={at} className="grid gap-3">
          <TurnView
            turn={turn}
            open={initiallyOpen !== toggled.has(at)}
            onToggle={(open) => toggle(at, open)}
            onAnswer={(requestId, answers) =>
              settle(requestId, onAnswer(requestId, answers))
            }
            onDecide={(requestId, allow) =>
              settle(requestId, onDecide(requestId, allow))
            }
          />
        </div>
      ))}
      {onSay ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            aria-label="Reply to the agent"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, as in any chat; Shift+Enter is a new line.
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing)
                return;
              e.preventDefault();
              send();
            }}
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-ink"
          />
          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {running && onStop ? (
              <Button type="button" variant="ghost" size="sm" onClick={onStop}>
                Stop
              </Button>
            ) : null}
            <Button type="submit" disabled={!draft.trim()}>
              Send
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function TurnView({
  turn,
  open,
  onToggle,
  onAnswer,
  onDecide,
}: {
  turn: Turn;
  open: boolean;
  onToggle: (open: boolean) => void;
  onAnswer: (requestId: string, answers: Record<string, string>) => Replied;
  onDecide: (requestId: string, allow: boolean) => Replied;
}) {
  if (turn.who === "you") {
    return (
      <Message state="you">
        <p className="whitespace-pre-wrap">{turn.text}</p>
      </Message>
    );
  }
  return (
    <Message
      state={agentState(turn, open)}
      working={turn.working}
      expanded={open}
      onToggle={() => onToggle(open)}
    >
      {turn.reply ? <Markdown>{turn.reply}</Markdown> : null}
      {turn.waiting.map((ev) => (
        <EventView
          key={ev.requestId}
          ev={ev}
          open
          onAnswer={(answers) => onAnswer(ev.requestId, answers)}
          onDecide={(allow) => onDecide(ev.requestId, allow)}
        />
      ))}
    </Message>
  );
}
