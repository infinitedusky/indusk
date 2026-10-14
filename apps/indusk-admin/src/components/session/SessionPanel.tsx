"use client";

import type { Question, StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * A session of the developer's own `claude`, as a person sees it
 * (admin-plan-authoring, ADR D2): what it says, the tools it uses, the
 * questions it asks with their choices, the tools it asks to use, and Stop.
 * Handed the session's events; reports a person's choices through its
 * callbacks. It never reads Claude's protocol — the package's `protocol.ts`
 * turned that into these events.
 */

export interface SessionPanelProps {
  events: StartedEvent[];
  running: boolean;
  onAnswer: (requestId: string, answers: Record<string, string>) => void;
  onDecide: (requestId: string, allow: boolean) => void;
  onStop: () => void;
  /** Reply in the person's own words; absent, the panel offers no message box. */
  onSay?: (text: string) => void;
  /** Fill the column it sits in: the log grows to the bottom and scrolls; the input stays below it. */
  fill?: boolean;
}

export function SessionPanel({
  events,
  running,
  onAnswer,
  onDecide,
  onStop,
  onSay,
  fill = false,
}: SessionPanelProps) {
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  // About ten lines tall, then it scrolls (Sandy, 2026-10-06). It follows new
  // events unless the person has scrolled up to read.
  const log = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when an event arrives
  useEffect(() => {
    const el = log.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [events.length]);
  const done = (requestId: string) =>
    setAnswered((prev) => new Set(prev).add(requestId));

  return (
    <section
      className={`flex flex-col gap-2 rounded-md border border-line bg-surface p-3 text-sm ${fill ? "min-h-0 flex-1" : ""}`}
      data-testid="session-panel"
    >
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Claude session</h2>
        {running ? (
          <Button variant="secondary" size="sm" onClick={onStop}>
            Stop
          </Button>
        ) : null}
      </header>
      <ol
        ref={log}
        data-testid="session-log"
        className={`flex flex-col gap-2 overflow-y-auto ${fill ? "min-h-0 flex-1" : "max-h-rail"}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          following.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {events.map((ev, i) => (
          // Events never reorder or disappear, so their position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
          <li key={i}>
            <EventView
              ev={ev}
              repeatsReply={replyRepeated(events, i)}
              open={"requestId" in ev && !answered.has(ev.requestId) && running}
              onAnswer={(answers) => {
                if (ev.type !== "question") return;
                onAnswer(ev.requestId, answers);
                done(ev.requestId);
              }}
              onDecide={(allow) => {
                if (ev.type !== "permission") return;
                onDecide(ev.requestId, allow);
                done(ev.requestId);
              }}
            />
          </li>
        ))}
      </ol>
      {running && onSay ? (
        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onSay(draft);
            setDraft("");
          }}
        >
          <textarea
            className="rounded-md border border-line p-2"
            rows={3}
            placeholder="Reply to Claude"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div>
            <Button size="sm" type="submit" disabled={!draft.trim()}>
              Send
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

/**
 * Whether a finished turn's text is the reply the log already shows just
 * above it: Claude Code's result carries the turn's last message again, and
 * the log should not say it twice.
 */
export function replyRepeated(events: StartedEvent[], i: number): boolean {
  const ev = events[i];
  if (!ev || ev.type !== "result" || !ev.text) return false;
  for (let n = i - 1; n >= 0; n--) {
    const before = events[n];
    if (before?.type === "text") return before.text.trim() === ev.text.trim();
    if (before?.type === "result") return false;
  }
  return false;
}

function EventView({
  ev,
  repeatsReply,
  open,
  onAnswer,
  onDecide,
}: {
  ev: StartedEvent;
  /** A finished turn's text is the reply shown above it: say "Turn done" alone. */
  repeatsReply: boolean;
  open: boolean;
  onAnswer: (answers: Record<string, string>) => void;
  onDecide: (allow: boolean) => void;
}) {
  switch (ev.type) {
    case "init":
      return (
        <p className="text-xs text-ink-faint">
          Claude Code {ev.version} · {ev.model} · {ev.cwd}
        </p>
      );
    case "trusted":
      return (
        <p className="text-xs text-ink-faint">
          This worktree is trusted like its project.
        </p>
      );
    case "untrusted":
      return (
        <p className="text-xs text-warn">
          Claude Code has not trusted {ev.cwd}, so its allow-list is ignored and
          more will be asked.
        </p>
      );
    case "text":
      return <p className="whitespace-pre-wrap text-ink">{ev.text}</p>;
    case "you":
      return (
        <p className="whitespace-pre-wrap rounded-md bg-idle-wash p-2 text-ink">
          {ev.text}
        </p>
      );
    case "tool":
      return (
        <p className="font-mono text-xs text-ink-faint">
          {ev.name} {describeInput(ev.input)}
        </p>
      );
    case "question":
      return (
        <QuestionView
          questions={ev.questions}
          open={open}
          onAnswer={onAnswer}
        />
      );
    case "permission":
      return (
        <div className="rounded-md border border-warn bg-warn-wash p-2">
          <p className="text-ink">
            Claude asks to use <span className="font-semibold">{ev.tool}</span>{" "}
            <span className="font-mono text-xs">{describeInput(ev.input)}</span>
          </p>
          {open ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => onDecide(true)}>
                Allow
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDecide(false)}
              >
                Deny
              </Button>
            </div>
          ) : null}
        </div>
      );
    // What happened, in the panel's own words — never Claude Code's status
    // word, which reads `success` beside an API error (small-fixes A7, A8).
    // promise: a-session-says-how-it-ended
    case "result":
      return ev.ok ? (
        <p className="text-ok">
          Turn done{ev.text && !repeatsReply ? ` — ${ev.text}` : ""}
        </p>
      ) : (
        <p className="text-bad">
          Failed —{" "}
          {ev.text ? ev.text.split("\n")[0] : failedWithoutText(ev.subtype)}
        </p>
      );
    case "exit":
      return (
        <p
          className={
            ev.code === 0 || ev.code === null ? "text-ink-faint" : "text-bad"
          }
        >
          Session ended
          {ev.code === null ? "" : ` (code ${ev.code})`}
          {ev.stderr ? `: ${ev.stderr.slice(-300)}` : ""}
        </p>
      );
    case "other":
      return <p className="font-mono text-xs text-ink-faint">{ev.text}</p>;
    default:
      return null;
  }
}

/**
 * Why a turn failed when Claude Code sent no text: `error_max_turns` and
 * `error_during_execution` carry only the subtype (small-fixes A22). Said in
 * words; the raw subtype is the protocol's, not the reader's.
 */
function failedWithoutText(subtype: string): string {
  if (subtype === "error_max_turns") return "the turn limit was reached";
  if (subtype === "error_during_execution")
    return "it stopped on an error while running";
  return "it stopped without a result";
}

const OTHER = "Other";

/**
 * A question with its choices, as Claude Code asks it: one choice, or several
 * when the question allows it, or Other — an answer in the person's own
 * words. Several labels go back joined by ", ".
 */
function QuestionView({
  questions,
  open,
  onAnswer,
}: {
  questions: Question[];
  open: boolean;
  onAnswer: (answers: Record<string, string>) => void;
}) {
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const answerFor = (q: Question): string => {
    const picks = chosen[q.question] ?? [];
    return picks
      .map((label) =>
        label === OTHER ? (other[q.question] ?? "").trim() : label,
      )
      .filter(Boolean)
      .join(", ");
  };
  const complete = questions.every((q) => answerFor(q) !== "");
  const toggle = (q: Question, label: string) =>
    setChosen((prev) => {
      const picks = prev[q.question] ?? [];
      if (!q.multiSelect) return { ...prev, [q.question]: [label] };
      return {
        ...prev,
        [q.question]: picks.includes(label)
          ? picks.filter((l) => l !== label)
          : [...picks, label],
      };
    });
  return (
    <div className="rounded-md border border-dusk bg-dusk-wash p-2">
      {questions.map((q) => {
        const picks = chosen[q.question] ?? [];
        return (
          <fieldset key={q.question} className="mb-2">
            <legend className="font-medium text-ink">
              {q.question}
              {q.multiSelect ? (
                <span className="ml-1 text-xs text-ink-faint">
                  (choose any)
                </span>
              ) : null}
            </legend>
            <div className="mt-1 flex flex-col gap-1">
              {[
                ...q.options,
                { label: OTHER, description: "Answer in your own words" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  disabled={!open}
                  onClick={() => toggle(q, o.label)}
                  className={`rounded-md border px-2 py-1 text-left ${
                    picks.includes(o.label)
                      ? "border-dusk bg-surface"
                      : "border-transparent"
                  }`}
                >
                  <span className="font-medium">{o.label}</span>
                  {o.description ? (
                    <span className="block text-xs text-ink-soft">
                      {o.description}
                    </span>
                  ) : null}
                </button>
              ))}
              {picks.includes(OTHER) && open ? (
                <input
                  aria-label="Other answer"
                  className="rounded-md border border-line px-2 py-1"
                  value={other[q.question] ?? ""}
                  onChange={(e) =>
                    setOther((prev) => ({
                      ...prev,
                      [q.question]: e.target.value,
                    }))
                  }
                />
              ) : null}
            </div>
          </fieldset>
        );
      })}
      {open ? (
        <Button
          size="sm"
          disabled={!complete}
          onClick={() =>
            onAnswer(
              Object.fromEntries(
                questions.map((q) => [q.question, answerFor(q)]),
              ),
            )
          }
        >
          Answer
        </Button>
      ) : null}
    </div>
  );
}

/** A tool's input in a few words: the path it names, or its command, or nothing. */
function describeInput(input: Record<string, unknown>): string {
  for (const key of [
    "file_path",
    "path",
    "notebook_path",
    "command",
    "pattern",
    "skill",
  ]) {
    if (typeof input[key] === "string") return String(input[key]);
  }
  return "";
}
