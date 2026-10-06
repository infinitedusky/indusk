"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
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
}: {
  project: string;
  plan: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/sessions")
      .then((r) => r.json())
      .then(
        (body: {
          session: { id: string; project: string; plan: string } | null;
        }) => {
          if (
            live &&
            body.session?.project === project &&
            body.session.plan === plan
          )
            setSessionId(body.session.id);
        },
      )
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [project, plan]);

  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await fetch("/api/plans/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project, plan }),
    });
    setBusy(false);
    if (!r.ok) {
      setProblem(
        ((await r.json().catch(() => ({}))) as { error?: string }).error ??
          `HTTP ${r.status}`,
      );
      return;
    }
    router.refresh();
  };

  if (!sessionId && !canApprove) return null;
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
      {problem ? (
        <pre className="whitespace-pre-wrap text-sm text-red-700">
          {problem}
        </pre>
      ) : null}
      {sessionId ? <SessionConnector sessionId={sessionId} /> : null}
    </div>
  );
}
