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
 * over the session the admin runs for the project (with its unanswered
 * question), the plans as read from disk and the builds the daemon holds; a
 * plan's recorded answers are `plans/history`'s.
 *
 * promise: decisions-wait-in-one-place
 */
export function readWaiting(project: string, plans: Plan[]): Waiting[] {
  const manager = sessionManager();
  const running = manager.current();
  const sessions =
    running && running.project === project
      ? [
          {
            plan: running.plan,
            kind: running.kind,
            question: manager.pendingQuestion(running.id) ?? null,
            writing: manager.isWriting(running.id),
          },
        ]
      : [];
  const builds = plans.map((p) => ({
    plan: p.name,
    stoppedAt: buildState(project, p.name)?.stop?.step ?? null,
  }));
  return planWaiting({ sessions, plans: plans.map(snapshotOf), builds });
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
