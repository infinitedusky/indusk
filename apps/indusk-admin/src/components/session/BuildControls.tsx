"use client";

import type { Review, RunnerStop } from "@infinitedusky/indusk-mcp/build";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const poll = async () => {
      const r = await fetch(
        `/api/plans/build?project=${encodeURIComponent(project)}&plan=${encodeURIComponent(plan)}`,
      );
      if (!live || !r.ok) return;
      const body = (await r.json()) as {
        build: BuildState | null;
        sessionId: string | null;
      };
      setState(body.build);
      setSessionId(body.sessionId);
    };
    void poll();
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [project, plan]);

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
          <span className="text-xs text-gray-500">
            Works the phases, then falsification and cleanup, without asking;
            stops at review.
          </span>
        </div>
      ) : null}
      {running && state?.step ? (
        <p className="text-gray-700">
          Running: {state.step}
          {state.detail ? ` — ${state.detail}` : ""}
        </p>
      ) : null}
      {!running && state?.stop ? (
        <p className="text-gray-700">{describeStop(state.stop)}</p>
      ) : null}
      {state?.release ? (
        <p
          className={state.release.released ? "text-green-700" : "text-red-700"}
        >
          {state.release.released
            ? "Released."
            : `The release stopped: ${state.release.error}`}
        </p>
      ) : null}
      {problem ? <p className="text-red-700">{problem}</p> : null}
      {inReview && review ? <ReviewPanel review={review} /> : null}
      {inReview && !running ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void post("accept")}>
            Accept
          </Button>
          <span className="text-xs text-gray-500">
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

function describeStop(stop: RunnerStop): string {
  switch (stop.step) {
    case "review":
      return "Built. It waits for your review.";
    case "judgement":
      return `Stopped for a judgement the plan declared — ${stop.item}`;
    case "cannot-continue":
      return `Stopped: ${stop.why}`;
    case "released":
      return "Built, accepted by its workflow, and released.";
    case "release-failed":
      return `Built and accepted by its workflow; the release stopped: ${stop.why}`;
  }
}
