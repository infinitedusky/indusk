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
 * accept, the alternative, or a reply in words. A plan stopped for review
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
    choice: "accept" | "alternative" | "reply",
    text?: string,
  ) => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ answer?: string }>(
      `/api/plans/${encodeURIComponent(waiting.plan)}/decision`,
      { project, choice, ...(choice === "reply" ? { text } : {}) },
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
        title={waiting.decision}
      >
        {waiting.on === "review" && review ? (
          <ReviewPanel review={review} />
        ) : null}
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
        {sent ? <p className="text-ok">Sent: {sent}</p> : null}
        {problem ? (
          <pre className="whitespace-pre-wrap text-bad">{problem}</pre>
        ) : null}
      </UiDecisionCard>
    </div>
  );
}
