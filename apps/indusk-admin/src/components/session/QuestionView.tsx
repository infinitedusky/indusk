"use client";

import type { Question } from "@infinitedusky/indusk-mcp/session";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Decision } from "@/lib/request-decisions";

const OTHER = "Other";

/**
 * A question with its choices, as Claude Code asks it: one choice, or several
 * when the question allows it, or Other — an answer in the person's own
 * words. Several labels go back joined by ", ".
 */
export function QuestionView({
  questions,
  open,
  decision,
  onAnswer,
}: {
  questions: Question[];
  open: boolean;
  /** How it was decided, when it has been: declined by the session, or answered by a person. */
  decision?: Decision;
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
      {decision && !decision.allow ? (
        <p className="text-bad">
          Declined
          {decision.message ? ` — ${decision.message}` : ""}
        </p>
      ) : null}
      {decision?.allow && decision.answers ? (
        <p className="text-ok">
          Answered —{" "}
          {Object.entries(decision.answers)
            .map(([question, answer]) => `${question}: ${answer}`)
            .join("; ")}
        </p>
      ) : null}
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
