"use client";

import type { Review } from "@infinitedusky/indusk-mcp/build";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReviewPanel } from "@/components/session/ReviewPanel";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * The one decision a plan waits on (plan-cockpit, ADR decisions 3 and 4):
 * the decision in words, the step it waits at, and three ways to answer —
 * accept, the alternative, or a reply in words. An ask of several questions
 * shows each, with its two answers, and sends them together — one answer under
 * each question's text. A plan stopped for review
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
  const asked = waiting.on === "question" ? (waiting.questions ?? []) : [];
  const several = asked.length > 1;

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
        ...(choice === "reply" ? { text } : {}),
        ...(choice === "answers" ? { answers: chosen } : {}),
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
    <section
      className="mb-4 flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm"
      data-testid="decision-card"
      data-on={waiting.on}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-amber-900">{HEADING[waiting.on]}</h2>
        <span className="text-xs text-amber-800">at {waiting.step}</span>
      </header>
      {several ? null : <p className="text-gray-900">{waiting.decision}</p>}
      {waiting.on === "review" && review ? (
        <ReviewPanel review={review} />
      ) : null}
      {several ? (
        <div className="flex flex-col gap-3">
          {asked.map((q) => (
            <fieldset
              key={q.question}
              className="flex flex-col gap-1"
              data-testid="decision-question"
            >
              <legend className="text-gray-900">{q.question}</legend>
              <div className="flex flex-wrap gap-2">
                {[q.accept, q.alternative].map((label) => (
                  <Button
                    key={label}
                    size="sm"
                    variant={
                      chosen[q.question] === label ? "primary" : "secondary"
                    }
                    aria-pressed={chosen[q.question] === label}
                    disabled={busy}
                    onClick={() =>
                      setChosen((c) => ({ ...c, [q.question]: label }))
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>
          ))}
          <div>
            <Button
              size="sm"
              data-testid="decision-send-answers"
              disabled={busy || asked.some((q) => !chosen[q.question])}
              onClick={() => void answer("answers")}
            >
              Send answers
            </Button>
          </div>
        </div>
      ) : null}
      {several ? null : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              data-testid="decision-accept"
              disabled={busy}
              onClick={() => void answer("accept")}
            >
              {waiting.accept}
            </Button>
            <Button
              size="sm"
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
            <label className="text-xs text-gray-600" htmlFor="decision-reply">
              Or say it in your own words
            </label>
            <textarea
              id="decision-reply"
              data-testid="decision-reply"
              className="min-h-16 w-full rounded border border-gray-300 bg-white p-2"
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
      {sent ? <p className="text-green-800">Sent: {sent}</p> : null}
      {problem ? (
        <pre className="whitespace-pre-wrap text-red-700">{problem}</pre>
      ) : null}
    </section>
  );
}
