"use client";

import type { Review, RunnerStop } from "@infinitedusky/indusk-mcp/build";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";
import { ReviewPanel } from "./ReviewPanel";
import { SessionConnector } from "./SessionConnector";

/**
 * A plan's build in the admin (admin-plan-authoring A11–A20): Build for an
 * approved plan, what the build is doing and why it stopped, and — once the
 * plan is in review — the evidence and Accept, which starts the release.
 * The decisions are the package's; this asks and shows.
 */

interface BuildState {
  running: boolean;
  step: string | null;
  detail: string | null;
  stop: RunnerStop | null;
  release: { released: boolean; error: string | null } | null;
}

export function BuildControls({
  project,
  plan,
  canBuild,
  inReview,
}: {
  project: string;
  plan: string;
  canBuild: boolean;
  inReview: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<BuildState | null>(null);
  // The phase the plan is on and how the run stopped, worded by the package from the plan.
  const [phase, setPhase] = useState<string | null>(null);
  const [sentence, setSentence] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const poll = useCallback(async (): Promise<boolean> => {
    const r = await fetch(
      `/api/plans/build?project=${encodeURIComponent(project)}&plan=${encodeURIComponent(plan)}`,
    );
    if (!r.ok) return false;
    const body = (await r.json()) as {
      build: BuildState | null;
      phase: string | null;
      sentence: string | null;
      sessionId: string | null;
    };
    setState(body.build);
    setPhase(body.phase);
    setSentence(body.sentence);
    setSessionId(body.sessionId);
    return true;
  }, [project, plan]);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      if (live) await poll();
    };
    void tick();
    const timer = setInterval(() => void tick(), 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [poll]);

  useEffect(() => {
    if (!inReview) return;
    void fetch(
      `/api/plans/review?project=${encodeURIComponent(project)}&plan=${encodeURIComponent(plan)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((body: Review | null) => setReview(body));
  }, [inReview, project, plan]);

  const post = async (path: string) => {
    setProblem(null);
    const r = await postJson<BuildState>(`/api/plans/${path}`, {
      project,
      plan,
    });
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    setState(r.body);
    await poll();
    router.refresh();
  };

  const running = state?.running ?? false;
  return (
    <div className="mb-4 flex flex-col gap-2 text-sm">
      {canBuild && !running ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void post("build")}>
            Build
          </Button>
          <span className="text-xs text-ink-faint">
            Works the phases, then falsification and cleanup, without asking;
            stops at review.
          </span>
        </div>
      ) : null}
      {running && state?.step ? (
        <p className="text-ink-soft">
          Running: {state.step}
          {phase ? ` — ${phase}` : state.detail ? ` — ${state.detail}` : ""}
        </p>
      ) : null}
      {!running && state?.stop ? (
        <p className="text-ink-soft">{sentence}</p>
      ) : null}
      {state?.release ? (
        <p className={state.release.released ? "text-ok" : "text-bad"}>
          {state.release.released
            ? "Released."
            : `The release stopped: ${state.release.error}`}
        </p>
      ) : null}
      {problem ? <p className="text-bad">{problem}</p> : null}
      {inReview && review ? <ReviewPanel review={review} /> : null}
      {inReview && !running ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void post("accept")}>
            Accept
          </Button>
          <span className="text-xs text-ink-faint">
            Runs the retrospective, which lands the plan on main.
          </span>
        </div>
      ) : null}
      {sessionId ? (
        <SessionConnector key={sessionId} sessionId={sessionId} />
      ) : null}
    </div>
  );
}
