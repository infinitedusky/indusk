import type {
  appendDecision,
  DecisionEntry,
} from "@infinitedusky/indusk-mcp/plans/history";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import type { ManagedStart } from "@infinitedusky/indusk-mcp/session";

/**
 * Where the answer to a plan's decision goes (plan-cockpit, ADR decision 4).
 * Stub — Build Phase 6 implements it.
 *
 * promise: decisions-wait-in-one-place
 */

export type DecisionChoice =
  | { choice: "accept" }
  | { choice: "alternative" }
  | { choice: "reply"; text: string };

export interface DecisionSessions {
  current(): { id: string; project: string; plan: string } | undefined;
  reply(
    id: string,
    reply: { requestId: string; answers: Record<string, string> },
  ): void;
  say(id: string, text: string): void;
  start(opts: ManagedStart): { id: string };
}

export interface DecisionDeps {
  sessions: DecisionSessions;
  where(): Promise<{ cwd: string; addDirs?: string[] } | { error: string }>;
  approve(): Promise<unknown>;
  release(): Promise<unknown>;
  record(entry: DecisionEntry): Pick<ReturnType<typeof appendDecision>, "commit">;
  now?: () => Date;
}

export interface Answered {
  answer: string;
  via: "question" | "approve" | "release" | "say" | "session";
  sessionId?: string;
  commit: ReturnType<typeof appendDecision>["commit"];
}

export async function answerDecision(
  _deps: DecisionDeps,
  _project: string,
  _waiting: Waiting,
  _choice: DecisionChoice,
): Promise<Answered> {
  return { answer: "", via: "say", commit: { committed: false, reason: "stub" } };
}
