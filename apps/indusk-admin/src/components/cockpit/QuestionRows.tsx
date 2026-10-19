"use client";

import type { Question } from "@infinitedusky/indusk-mcp/questions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuestionRow } from "@/components/ui/QuestionRow";
import { postJson } from "@/lib/post-json";
import { openQuestions, whenOf, whereOf } from "@/lib/question-view";

/**
 * A plan's questions on its page (decisions-as-questions, ADR decision 7): each open
 * one as a row, expensive first, with its options and a reply in words, and the ones
 * answered or sent ahead and answered beneath, each readable with its recommendation,
 * answer and what was done. Answers go to the plan's question route. The package stored
 * each question's cost; this never works one out.
 *
 * promise: decisions-wait-in-one-place
 * clause: a-late-answer-opens-a-follow-on/every-decision-stays
 */
export function QuestionRows({
  project,
  plan,
  questions,
  now,
}: {
  project: string;
  plan: string;
  questions: Question[];
  /** The time the page was read, so the rows' words agree with the server's. */
  now: number;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState<string | null>(null);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const open = openQuestions(questions);
  const closed = questions.filter(
    (q) => q.state === "answered" || q.state === "answered-late",
  );
  if (open.length === 0 && closed.length === 0) return null;

  const answer = async (id: string, text: string) => {
    setBusy(true);
    setProblem(null);
    const r = await postJson(
      `/api/plans/${encodeURIComponent(plan)}/question`,
      {
        project,
        id,
        text,
      },
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    setReplying(null);
    setWords("");
    router.refresh();
  };

  return (
    <div className="grid gap-3" data-testid="question-rows">
      {open.map((q) => {
        const went = q.state === "went-ahead";
        return (
          <div key={q.id} data-testid="question-row" data-question={q.id}>
            <QuestionRow
              cost={q.cost}
              wentAhead={went}
              where={whereOf(q)}
              when={whenOf(q, now)}
              text={q.text}
              reason={q.reason}
              {...(q.done ? { done: q.done } : {})}
              options={(went
                ? q.options.filter((o) => o.label !== q.done)
                : q.options
              ).map((o) => ({
                label: o.label,
                recommended: o.label === q.recommended,
              }))}
              disabled={busy}
              onChoose={(label) => void answer(q.id, label)}
              {...(went ? {} : { onReply: () => setReplying(q.id) })}
            >
              {replying === q.id ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void answer(q.id, words);
                  }}
                >
                  <textarea
                    aria-label={`Your own words for: ${q.text}`}
                    data-testid="question-reply"
                    className="min-h-12 w-full rounded-md border border-line bg-surface p-2"
                    value={words}
                    onChange={(e) => setWords(e.target.value)}
                  />
                  <div>
                    <button
                      type="submit"
                      data-testid="question-send"
                      disabled={busy || !words.trim()}
                      className="rounded-lg border border-line bg-surface px-4 py-snug text-sm font-semibold disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </form>
              ) : null}
            </QuestionRow>
          </div>
        );
      })}
      {problem ? (
        <pre className="whitespace-pre-wrap text-bad">{problem}</pre>
      ) : null}
      {closed.length > 0 ? (
        <ul
          className="grid list-none gap-1 text-sm leading-3 text-ink-soft"
          data-testid="questions-answered"
        >
          {closed.map((q) => (
            <li key={q.id} data-question={q.id} data-state={q.state}>
              <b className="font-semibold text-ink">{q.id}</b> {q.text} —
              recommended {q.recommended}
              {q.done ? `; went ahead with ${q.done}` : ""}; answered{" "}
              <b className="font-semibold text-ink">{q.answer}</b>
              {q.state === "answered-late" ? " (late)" : ""}
              {q.followOn ? (
                <>
                  {" · "}
                  <Link
                    href={`/p/${project}/plan/${q.followOn}`}
                    data-testid="question-follow-on"
                    className="text-dusk"
                  >
                    follow-on {q.followOn}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
