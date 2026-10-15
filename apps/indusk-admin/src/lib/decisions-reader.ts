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
import { buildState } from "./build-host";
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
 * decision 5.
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
    }));
  const builds = plans.map((p) => ({
    plan: p.name,
    stoppedAt: buildState(project, p.name)?.stop?.step ?? null,
  }));
  const amendments = await amendmentCounts(projectPath, plans);
  return planWaiting({
    sessions,
    plans: plans.map(snapshotOf),
    builds,
    amendments,
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
