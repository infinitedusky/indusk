import type { Question } from "@infinitedusky/indusk-mcp/questions";

/**
 * Where a person's answer to one question goes (decisions-as-questions, ADR decision
 * 7), by the question's state. The record is what the package's `answerQuestionRecord`
 * applies; this only routes the answer to what acts on it:
 *
 *   - waiting, its session alive (a set time): told to that session, which goes on; a
 *     session that has gone is the next case;
 *   - waiting, no session (a hold, or a session the admin lost): the run starts again
 *     and tells the agent;
 *   - went ahead: recorded late; a differing answer opens the follow-on in the record.
 *
 * An empty reply is not an answer, and a question already answered is refused.
 * promise: decisions-wait-in-one-place
 */
export interface QuestionAnswerDeps {
  find(id: string): Question | undefined;
  /** Apply the answer to the record; returns the record as kept. */
  record(id: string, text: string): Question;
  /** Tell a live session its question's answer. */
  tellSession(
    sessionId: string,
    requestId: string,
    text: string,
    question: string,
  ): void;
  /** Start the plan's run again. */
  resume(): Promise<unknown>;
  /** Record the answer as a decision in the plan's history. */
  decision(entry: {
    decision: string;
    answer: string;
    by: string;
    at: string;
  }): void;
  now?: () => Date;
}

export interface QuestionAnswered {
  question: Question;
  via: "session" | "resume" | "late";
  /** Why the run did not start again, when the answer was kept but the restart was refused. */
  restartRefused?: string;
}

export async function answerOneQuestion(
  deps: QuestionAnswerDeps,
  id: string,
  text: string,
): Promise<QuestionAnswered> {
  const before = deps.find(id);
  if (!before) throw new Error(`no question ${id}`);
  // A late answer may be given again (it rewrites the open follow-on); one in time is final.
  if (before.state === "answered") {
    throw new Error(`question ${id} was already answered`);
  }
  if (!text.trim())
    throw new Error("a reply needs words: an empty reply is not an answer");
  let via: QuestionAnswered["via"];
  if (before.state === "went-ahead" || before.state === "answered-late")
    via = "late";
  else if (before.session) via = "session";
  else via = "resume";
  if (via === "session" && before.session) {
    try {
      deps.tellSession(
        before.session.id,
        before.session.requestId,
        text.trim(),
        before.text,
      );
    } catch (err) {
      // The session has gone (an admin restart, a dead `claude`): keep the answer and
      // start the run again, which tells the agent. Any other refusal is the person's to see.
      if (!/no session .* is running/.test((err as Error).message)) throw err;
      via = "resume";
    }
  }
  const question = deps.record(id, text);
  deps.decision({
    decision: `${id}: ${before.text}`,
    answer: text.trim(),
    by: "person",
    at: (deps.now?.() ?? new Date()).toISOString(),
  });
  let restartRefused: string | undefined;
  if (via === "resume") {
    try {
      await deps.resume();
    } catch (err) {
      // The answer is kept and the plan stays under Needs you, answered and waiting to restart.
      restartRefused = (err as Error).message;
    }
  }
  return { question, via, ...(restartRefused ? { restartRefused } : {}) };
}
