"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";
import {
  ownsSession,
  type RunningSession,
  sessionUrl,
} from "@/lib/session-owner";
import { SessionConnector } from "./SessionConnector";

/**
 * The first message of a planning session: read the brief, say where it
 * stands, and wait — the person leads, the agent does not run the planner
 * unasked. The Read tool, not a shell, so the catch-up asks no permission.
 */
export function briefOpening(plan: string): string {
  return [
    `You are writing the brief of the plan "${plan}" with the person, on its brief page; they see its promises, expectations and looks beside you as you write them.`,
    `Use the Read tool (not Bash) to read .indusk/planning/${plan}/brief.md and research.md if they exist, and the planner skill's rules for a brief.`,
    "The brief's frontmatter carries a `description:` — the plan in one to three tight sentences; write or tighten it when it is missing or long.",
    "Then say in two or three sentences where the brief stands and what it is missing, and ask what the person wants to work on. Do nothing else until they answer.",
  ].join("\n");
}

/**
 * The first message of the plan page's agent: questions about the plan, not
 * writing it — a change to what was agreed is made by reopening the brief.
 */
export function planOpening(plan: string): string {
  return [
    `You are the agent on the page of the plan "${plan}". The person asks you about the plan: where it stands, what it promises, whether something should change.`,
    `Use the Read tool (not Bash) to read .indusk/planning/${plan}/brief.md and impl.md if they exist.`,
    "When what they want changes the brief — a promise, an expectation or a look — say so and tell them to reopen it on the brief page; do not edit it from here.",
    "Ask what they want to know, in one sentence, and do nothing else until they answer.",
  ].join("\n");
}

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
  approvedHref,
  opening = briefOpening,
  startLabel = "Talk to the agent",
  fill = false,
}: {
  project: string;
  plan: string;
  canApprove: boolean;
  /** A plan on its own branch, not yet approved: a planning session can be started or resumed (A6). */
  canPlan?: boolean;
  /** Where Approve moves once it succeeds: the plan's page, from its brief. */
  approvedHref?: string;
  /** The session's first message: the brief page's or the plan page's. */
  opening?: (plan: string) => string;
  startLabel?: string;
  /** Fill the column it sits in: the brief page's agent runs to the window's bottom. */
  fill?: boolean;
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch(sessionUrl(project, plan, "planning"))
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
    if (approvedHref) router.push(approvedHref);
    else router.refresh();
  };

  const continuePlanning = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>("/api/sessions", {
      project,
      plan,
      kind: "planning",
      prompt: opening(plan),
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
    <div className={`flex flex-col gap-2 ${fill ? "min-h-0 flex-1" : "mb-4"}`}>
      {canApprove ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void approve()} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
          <span className="text-xs text-ink-faint">
            Checks the brief, then brings the plan's documents and promises to
            main; the build continues on its branch.
          </span>
        </div>
      ) : null}
      {canPlan && !sessionId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="whitespace-nowrap"
            onClick={() => void continuePlanning()}
            disabled={busy}
          >
            {startLabel}
          </Button>
          <span className="text-xs text-ink-faint">
            Starts a session in this plan's worktree; it waits for you.
          </span>
        </div>
      ) : null}
      {problem ? (
        <pre className="whitespace-pre-wrap text-sm text-bad">{problem}</pre>
      ) : null}
      {sessionId ? (
        <SessionConnector sessionId={sessionId} fill={fill} />
      ) : null}
    </div>
  );
}
