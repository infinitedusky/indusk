"use client";

import type { Review } from "@infinitedusky/indusk-mcp/build";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReviewPanel } from "@/components/session/ReviewPanel";
import { Button } from "@/components/ui/Button";
import { DecisionCard as UiDecisionCard } from "@/components/ui/DecisionCard";
import { postJson } from "@/lib/post-json";

/**
 * The one decision a plan waits on (plan-cockpit, ADR decisions 3 and 4):
 * the decision in words, the step it waits at, and three ways to answer —
 * accept, the alternative, or a reply in words. An ask of several questions
 * shows each, with its two answers and a box for the person's own words, and
 * sends them together — one answer under each question's text. A plan stopped for review
 * shows its evidence here, as the build controls show it (`ReviewPanel`,
 * read from `indusk plans review`). Every answer goes to the plan's decision
 * route, which routes it and records it; this asks and shows.
 *
 * promise: decisions-wait-in-one-place
 * promise: a-review-shows-its-evidence
 */

const HEADING: Record<Waiting["on"], string> = {
  question: "Claude needs you",
  approval: "Waiting for your approval",
  review: "Waiting for your review",
  "plan-review": "Needs its plan review",
  // Never drawn here: an amendment is answered on its own card.
  amendment: "The brief changed",
};

export function DecisionCard({
  project,
  waiting,
}: {
  project: string;
  waiting: Waiting;
}) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [said, setSaid] = useState<Record<string, string>>({});
  const asked = waiting.on === "question" ? (waiting.questions ?? []) : [];
  const several = asked.length > 1;
  /** A question's answer: the person's own words, else the option chosen. */
  const answerTo = (question: string) =>
    said[question]?.trim() || chosen[question] || "";

  useEffect(() => {
    if (waiting.on !== "review") return;
    let live = true;
    void fetch(
      `/api/plans/review?project=${encodeURIComponent(project)}&plan=${encodeURIComponent(waiting.plan)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((body: Review | null) => {
        if (live) setReview(body);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [waiting.on, waiting.plan, project]);

  const answer = async (
    choice: "accept" | "alternative" | "reply" | "answers",
    text?: string,
  ) => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ answer?: string }>(
      `/api/plans/${encodeURIComponent(waiting.plan)}/decision`,
      {
        project,
        choice,
        on: waiting.on,
        ...(choice === "reply" ? { text } : {}),
        ...(choice === "answers"
          ? {
              answers: Object.fromEntries(
                asked.map((q) => [q.question, answerTo(q.question)]),
              ),
            }
          : {}),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    setSent(r.body.answer ?? null);
    setWords("");
    router.refresh();
  };

  return (
    <div data-testid="decision-card" data-on={waiting.on}>
      <UiDecisionCard
        tone="ask"
        who={{
          label: `${HEADING[waiting.on]} at ${waiting.step}`,
          state: "ask",
        }}
        title={several ? undefined : waiting.decision}
      >
        {waiting.on === "review" && review ? (
          <ReviewPanel review={review} />
        ) : null}
        {several ? (
          <div className="flex flex-col gap-4">
            {asked.map((q) => (
              <fieldset
                key={q.question}
                className="flex flex-col gap-2"
                data-testid="decision-question"
              >
                <legend className="mb-2">{q.question}</legend>
                <div className="flex flex-wrap gap-snug">
                  {[q.accept, q.alternative].map((label) => (
                    <Button
                      key={label}
                      variant={
                        chosen[q.question] === label &&
                        !said[q.question]?.trim()
                          ? "primary"
                          : "secondary"
                      }
                      aria-pressed={
                        chosen[q.question] === label &&
                        !said[q.question]?.trim()
                      }
                      disabled={busy}
                      onClick={() => {
                        setChosen((c) => ({ ...c, [q.question]: label }));
                        setSaid((w) => ({ ...w, [q.question]: "" }));
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <textarea
                  aria-label={`Your own words for: ${q.question}`}
                  data-testid="decision-question-words"
                  placeholder="Or say it in your own words"
                  className="min-h-12 w-full rounded-md border border-line bg-surface p-2"
                  value={said[q.question] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setSaid((w) => ({ ...w, [q.question]: e.target.value }))
                  }
                />
              </fieldset>
            ))}
            <div>
              <Button
                data-testid="decision-send-answers"
                disabled={busy || asked.some((q) => !answerTo(q.question))}
                onClick={() => void answer("answers")}
              >
                Send answers
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-snug">
              <Button
                data-testid="decision-accept"
                disabled={busy}
                onClick={() => void answer("accept")}
              >
                {waiting.accept}
              </Button>
              <Button
                variant="secondary"
                data-testid="decision-alternative"
                disabled={busy}
                onClick={() => void answer("alternative")}
              >
                {waiting.alternative}
              </Button>
            </div>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void answer("reply", words);
              }}
            >
              <label className="text-xs text-ink-soft" htmlFor="decision-reply">
                Or say it in your own words
              </label>
              <textarea
                id="decision-reply"
                data-testid="decision-reply"
                className="min-h-16 w-full rounded-md border border-line bg-surface p-2"
                value={words}
                onChange={(e) => setWords(e.target.value)}
              />
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  type="submit"
                  data-testid="decision-send"
                  disabled={busy || !words.trim()}
                >
                  Send
                </Button>
              </div>
            </form>
          </>
        )}
        {sent ? <p className="text-ok">Sent: {sent}</p> : null}
        {problem ? (
          <pre className="whitespace-pre-wrap text-bad">{problem}</pre>
        ) : null}
      </UiDecisionCard>
    </div>
  );
}
