"use client";

import { useEffect, useState } from "react";
import { SessionConnector } from "@/components/session/SessionConnector";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";
import {
  ownsSession,
  type RunningSession,
  sessionUrl,
} from "@/lib/session-owner";

/**
 * *Start a fix plan* on a broken promise's page (plan-cockpit, ADR decision
 * 4): asks the admin to start the developer's own `claude` for the break and
 * shows the session beneath — the whole fix without a terminal. What the
 * session is told is the package's `fixPrompt`, built in the route. A session
 * already running for the promise's plan is shown on arrival, so a reload does
 * not lose it.
 *
 * promise: a-break-opens-a-fix-in-one-click
 */
export function StartFix({
  project,
  promise,
  plan,
}: {
  project: string;
  promise: string;
  /** The plan that owns the promise; the fix session is recorded against it. */
  plan: string;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch(sessionUrl(project, plan, "planning"))
      .then((r) => r.json())
      .then((body: { session?: RunningSession | null }) => {
        if (live && ownsSession(body.session, project, plan, "planning"))
          setSessionId(body.session.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [project, plan]);

  const start = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>(
      `/api/promises/${encodeURIComponent(promise)}/fix`,
      { project },
    );
    setBusy(false);
    if (!r.ok || !r.body.id) {
      setProblem(r.ok ? "the admin started no session" : r.error);
      return;
    }
    setSessionId(r.body.id);
  };

  return (
    <div className="flex flex-col gap-2">
      {sessionId ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            data-testid="start-fix"
            onClick={() => void start()}
            disabled={busy}
          >
            {busy ? "Starting…" : "Start a fix plan"}
          </Button>
          <span className="text-xs text-ink-soft">
            Starts Claude here with the break, its trace and its tests.
          </span>
        </div>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-bad">
          {problem}
        </p>
      ) : null}
      {sessionId ? (
        <div data-testid="fix-session">
          <SessionConnector sessionId={sessionId} />
        </div>
      ) : null}
    </div>
  );
}
