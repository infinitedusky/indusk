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
}

export function SessionPanel({
  events,
  running,
  onAnswer,
  onDecide,
  onStop,
  onSay,
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
      className="flex flex-col gap-2 rounded border border-gray-200 bg-white p-3 text-sm"
      data-testid="session-panel"
    >
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Claude session</h2>
        {running ? (
          <Button variant="secondary" size="sm" onClick={onStop}>
            Stop
          </Button>
        ) : null}
      </header>
      <ol
        ref={log}
        data-testid="session-log"
        className="flex max-h-60 flex-col gap-2 overflow-y-auto"
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
            className="rounded border border-gray-300 p-2"
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

function EventView({
  ev,
  open,
  onAnswer,
  onDecide,
}: {
  ev: StartedEvent;
  open: boolean;
  onAnswer: (answers: Record<string, string>) => void;
  onDecide: (allow: boolean) => void;
}) {
  switch (ev.type) {
    case "init":
      return (
        <p className="text-xs text-gray-400">
          Claude Code {ev.version} · {ev.model} · {ev.cwd}
        </p>
      );
    case "trusted":
      return (
        <p className="text-xs text-gray-500">
          This worktree is trusted like its project.
        </p>
      );
    case "untrusted":
      return (
        <p className="text-xs text-amber-700">
          Claude Code has not trusted {ev.cwd}, so its allow-list is ignored and
          more will be asked.
        </p>
      );
    case "text":
      return <p className="whitespace-pre-wrap text-gray-800">{ev.text}</p>;
    case "you":
      return (
        <p className="whitespace-pre-wrap rounded bg-gray-100 p-2 text-gray-900">
          {ev.text}
        </p>
      );
    case "tool":
      return (
        <p className="font-mono text-xs text-gray-500">
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
        <div className="rounded border border-amber-300 bg-amber-50 p-2">
          <p className="text-gray-800">
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
        <p className="text-green-700">
          Turn done{ev.text ? ` — ${ev.text}` : ""}
        </p>
      ) : (
        <p className="text-red-700">
          Failed —{" "}
          {ev.text ? ev.text.split("\n")[0] : failedWithoutText(ev.subtype)}
        </p>
      );
    case "exit":
      return (
        <p
          className={
            ev.code === 0 || ev.code === null ? "text-gray-500" : "text-red-700"
          }
        >
          Session ended
          {ev.code === null ? "" : ` (code ${ev.code})`}
          {ev.stderr ? `: ${ev.stderr.slice(-300)}` : ""}
        </p>
      );
    case "other":
      return <p className="font-mono text-xs text-gray-400">{ev.text}</p>;
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
    <div className="rounded border border-blue-300 bg-blue-50 p-2">
      {questions.map((q) => {
        const picks = chosen[q.question] ?? [];
        return (
          <fieldset key={q.question} className="mb-2">
            <legend className="font-medium text-gray-900">
              {q.question}
              {q.multiSelect ? (
                <span className="ml-1 text-xs text-gray-500">(choose any)</span>
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
                  className={`rounded border px-2 py-1 text-left ${
                    picks.includes(o.label)
                      ? "border-blue-600 bg-white"
                      : "border-transparent"
                  }`}
                >
                  <span className="font-medium">{o.label}</span>
                  {o.description ? (
                    <span className="block text-xs text-gray-600">
                      {o.description}
                    </span>
                  ) : null}
                </button>
              ))}
              {picks.includes(OTHER) && open ? (
                <input
                  aria-label="Other answer"
                  className="rounded border border-gray-300 px-2 py-1"
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
