import type {
  appendDecision,
  DecisionEntry,
} from "@infinitedusky/indusk-mcp/plans/history";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import type { ManagedStart } from "@infinitedusky/indusk-mcp/session";

/**
 * Where the answer to a plan's decision goes (plan-cockpit, ADR decision 4).
 * What the plan waits on is the package's `planWaiting`; this only routes the
 * person's answer to the thing that acts on it, then records it:
 *
 *   - a **question**: the chosen option — or the person's words — as the
 *     answer, through the session manager's `reply`, as the session panel
 *     answers it. An ask of several questions is answered in full: one answer
 *     under each question's text, or it is refused.
 *   - **approval**: accept is `plans approve`; **review**: accept is
 *     `acceptPlan` and the release, as BuildControls' Accept does.
 *   - otherwise the words (or the alternative, which is words) go to the
 *     plan's agent: `say` to the session running for the plan, or a new
 *     session for the plan, in its worktree, with the decision and the words
 *     as its prompt. Never queued: nothing would drain a queue.
 *
 * Every answer that reached its target is recorded by `plans/history`; one
 * that failed is not. The session manager, the plan's location and the
 * commands come in as `deps`, so a test reaches the routing without a daemon.
 *
 * promise: decisions-wait-in-one-place
 */

export type DecisionChoice =
  | { choice: "accept" }
  | { choice: "alternative" }
  | { choice: "reply"; text: string }
  /** An answer to each question of an ask, by the question's own text. */
  | { choice: "answers"; answers: Record<string, string> };

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
  /** Where the plan lives now — its worktree while it has one. */
  where(): Promise<{ cwd: string; addDirs?: string[] } | { error: string }>;
  /** `indusk plans approve` for the plan. */
  approve(): Promise<unknown>;
  /** `acceptPlan` and the release, as the build's Accept runs them. */
  release(): Promise<unknown>;
  /** `appendDecision` for the plan. */
  record(
    entry: DecisionEntry,
  ): Pick<ReturnType<typeof appendDecision>, "commit">;
  now?: () => Date;
}

export interface Answered {
  answer: string;
  via: "question" | "approve" | "release" | "say" | "session";
  sessionId?: string;
  commit: ReturnType<typeof appendDecision>["commit"];
}

export async function answerDecision(
  deps: DecisionDeps,
  project: string,
  waiting: Waiting,
  choice: DecisionChoice,
): Promise<Answered> {
  const answer = answerOf(waiting, choice);
  const reached = await deliver(deps, project, waiting, choice, answer);
  // The answer has reached its target: a history that cannot be written is
  // reported beside it, never as a failed answer — a retry would send it twice.
  let commit: Answered["commit"];
  try {
    ({ commit } = deps.record({
      decision: waiting.decision,
      answer,
      by: "person",
      at: (deps.now?.() ?? new Date()).toISOString(),
    }));
  } catch (err) {
    commit = {
      committed: false,
      reason: `the answer was sent but not recorded: ${(err as Error).message}`,
    };
  }
  return { answer, ...reached, commit };
}

/** The answer in words: the option or command chosen, or the person's own. */
function answerOf(waiting: Waiting, choice: DecisionChoice): string {
  if (choice.choice === "answers") {
    return Object.entries(choice.answers)
      .map(([question, answer]) => `${question} — ${answer}`)
      .join("\n");
  }
  if (choice.choice === "accept") return waiting.accept;
  if (choice.choice === "alternative") return waiting.alternative;
  const text = choice.text.trim();
  if (!text) throw new Error("a reply needs words");
  return text;
}

async function deliver(
  deps: DecisionDeps,
  project: string,
  waiting: Waiting,
  choice: DecisionChoice,
  answer: string,
): Promise<Pick<Answered, "via" | "sessionId">> {
  const running = deps.sessions.current();
  const ours =
    running && running.project === project && running.plan === waiting.plan
      ? running
      : undefined;

  if (waiting.on === "question") {
    if (!ours || !waiting.requestId) {
      throw new Error(
        `no session is running for ${waiting.plan} to answer its question`,
      );
    }
    deps.sessions.reply(ours.id, {
      requestId: waiting.requestId,
      answers: questionAnswers(waiting, choice, answer),
    });
    return { via: "question", sessionId: ours.id };
  }
  if (choice.choice === "accept") {
    if (waiting.on === "approval") {
      await deps.approve();
      return { via: "approve" };
    }
    await deps.release();
    return { via: "release" };
  }
  if (ours) {
    deps.sessions.say(ours.id, answer);
    return { via: "say", sessionId: ours.id };
  }
  const where = await deps.where();
  if ("error" in where) throw new Error(where.error);
  const { id } = deps.sessions.start({
    cwd: where.cwd,
    ...(where.addDirs ? { addDirs: where.addDirs } : {}),
    kind: "planning",
    prompt: replyPrompt(waiting, answer),
    project,
    plan: waiting.plan,
    onEvent: () => {},
  });
  return { via: "session", sessionId: id };
}

/** The answers a question's reply carries: one under each question's text, none left out. */
function questionAnswers(
  waiting: Waiting,
  choice: DecisionChoice,
  answer: string,
): Record<string, string> {
  const asked = waiting.questions?.map((q) => q.question) ?? [waiting.decision];
  if (choice.choice !== "answers") {
    if (asked.length > 1) {
      throw new Error(
        `${waiting.plan} asked ${asked.length} questions; answer each one`,
      );
    }
    return { [waiting.decision]: answer };
  }
  const missing = asked.filter((q) => !choice.answers[q]?.trim());
  if (missing.length > 0) {
    throw new Error(`no answer to: ${missing.join("; ")}`);
  }
  return Object.fromEntries(asked.map((q) => [q, choice.answers[q] as string]));
}

/** The first message of a session started to carry a reply to the plan's agent. */
function replyPrompt(waiting: Waiting, words: string): string {
  return [
    `Plan ${waiting.plan} was waiting on the person at its ${waiting.step} step:`,
    "",
    `> ${waiting.decision}`,
    "",
    "They answered, in their own words:",
    "",
    `> ${words}`,
    "",
    `Carry on with ${waiting.plan} from there.`,
  ].join("\n");
}
