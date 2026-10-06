"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";
import { ownsSession, type RunningSession } from "@/lib/session-owner";
import { SessionConnector } from "./SessionConnector";

/**
 * A plan's controls in the admin (admin-plan-authoring): the session running
 * for this plan, if any, and Approve once its impl is written and not yet
 * approved. Approve is `indusk plans approve`; its refusal is shown as the
 * command words it.
 */
export function PlanSession({
  project,
  plan,
  canApprove,
  canPlan = false,
}: {
  project: string;
  plan: string;
  canApprove: boolean;
  /** A plan on its own branch, not yet approved: a planning session can be started or resumed (A6). */
  canPlan?: boolean;
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/sessions")
      .then((r) => r.json())
      .then((body: { session: RunningSession | null }) => {
        if (live && ownsSession(body.session, project, plan, "planning"))
          setSessionId(body.session.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [project, plan]);

  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson("/api/plans/approve", { project, plan });
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    router.refresh();
  };

  const continuePlanning = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>("/api/sessions", {
      project,
      plan,
      kind: "planning",
      prompt: `/planner ${plan}`,
    });
    setBusy(false);
    if (!r.ok || !r.body.id) {
      setProblem(r.ok ? "the admin started no session" : r.error);
      return;
    }
    setSessionId(r.body.id);
  };

  if (!sessionId && !canApprove && !canPlan) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {canApprove ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void approve()} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
          <span className="text-xs text-gray-500">
            Checks the brief, then brings the plan's documents and promises to
            main; the build continues on its branch.
          </span>
        </div>
      ) : null}
      {canPlan && !sessionId ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void continuePlanning()}
            disabled={busy}
          >
            Continue planning
          </Button>
          <span className="text-xs text-gray-500">
            Starts a planning session in this plan's worktree.
          </span>
        </div>
      ) : null}
      {problem ? (
        <pre className="whitespace-pre-wrap text-sm text-red-700">
          {problem}
        </pre>
      ) : null}
      {sessionId ? <SessionConnector sessionId={sessionId} /> : null}
    </div>
  );
}
