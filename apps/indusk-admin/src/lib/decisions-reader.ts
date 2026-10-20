import { join } from "node:path";
import { amendmentsWaiting } from "@infinitedusky/indusk-mcp/plans/amendments";
import {
  type DecisionEntry,
  readHistory,
} from "@infinitedusky/indusk-mcp/plans/history";
import {
  planWaiting,
  type Waiting,
} from "@infinitedusky/indusk-mcp/plans/waiting";
import {
  readQuestions,
  sweepHistory,
} from "@infinitedusky/indusk-mcp/questions";
import { readQuestionWaitSetting } from "@infinitedusky/indusk-mcp/session";
import { buildState, planningState } from "./build-host";

export { withSituations } from "./plan-situation";

import { snapshotOf } from "./plan-snapshot";
import type { Plan } from "./planning-reader";
import { sessionManager } from "./session-host";

/**
 * The cockpit's reads of decisions (plan-cockpit, ADR decision 4): fs- and
 * daemon-to-props glue. What a plan waits on is the package's `planWaiting`,
 * over every session the admin runs for the project (with its unanswered
 * question), the plans as read from disk and the builds the daemon holds; a
 * plan's recorded answers are `plans/history`'s. Amendments are found only for
 * a plan whose brief no longer matches its approval, in the checkout the plan
 * is worked in (its worktree, else the project's own) — plan-stories, ADR
 * decision 5. Each plan's planning run, as the daemon holds it, goes in too, so
 * nothing is listed while one is going and a stopped one's reason is said.
 *
 * promise: decisions-wait-in-one-place
 */
export async function readWaiting(
  project: string,
  projectPath: string,
  plans: Plan[],
): Promise<Waiting[]> {
  const manager = sessionManager();
  const sessions = manager
    .running()
    .filter((r) => r.project === project)
    .map((r) => ({
      plan: r.plan,
      kind: r.kind,
      question: manager.pendingQuestion(r.id) ?? null,
      writing: manager.isWriting(r.id),
    }));
  const builds = plans.map((p) => ({
    plan: p.name,
    stoppedAt: buildState(project, p.name)?.stop?.step ?? null,
  }));
  const amendments = await amendmentCounts(projectPath, plans);
  // Every read sends a question whose stored time has come on with its recommendation,
  // then lists the plans' questions as the sweep left them (decisions-as-questions).
  const questions = plans.flatMap((p) => sweptQuestions(projectPath, p.name));
  return planWaiting({
    questions,
    sessions,
    plans: plans.map(snapshotOf),
    builds,
    amendments,
    plannings: plans.flatMap((p) => {
      const s = planningState(project, p.name);
      return s ? [{ plan: p.name, running: s.running, stop: s.stop }] : [];
    }),
  });
}

/** Each plan's waiting amendments, read in the checkout the plan is worked in. */
async function amendmentCounts(
  projectPath: string,
  plans: Plan[],
): Promise<{ plan: string; count: number }[]> {
  return Promise.all(
    plans.map(async (p) => ({
      plan: p.name,
      count: (
        await amendmentsWaiting(
          join(p.worktree?.path ?? projectPath, ".indusk", "planning", p.name),
        )
      ).length,
    })),
  );
}

/** `plan`'s recorded decisions, oldest first; none when they cannot be read. */
export function readPlanHistory(
  projectPath: string,
  plan: string,
): DecisionEntry[] {
  try {
    return readHistory(projectPath, plan);
  } catch {
    return [];
  }
}

/** Sweep one plan's questions and return them as they now stand; a history that cannot be read lists none. */
function sweptQuestions(projectPath: string, plan: string) {
  try {
    return sweepHistory(
      projectPath,
      plan,
      Date.now(),
      () => readQuestionWaitSetting(),
      (q, choice) => {
        if (!q.session) return;
        sessionManager().reply(
          q.session.id,
          { requestId: q.session.requestId, answers: { [q.text]: choice } },
          "rule",
        );
      },
    );
  } catch {
    return [];
  }
}

/** The plan's recorded questions, each as last recorded; none when they cannot be read. */
export function readPlanQuestions(projectPath: string, plan: string) {
  try {
    return readQuestions(projectPath, plan);
  } catch {
    return [];
  }
}
