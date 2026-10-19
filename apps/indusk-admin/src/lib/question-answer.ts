import type { Question } from "@infinitedusky/indusk-mcp/questions";

/**
 * Where a person's answer to one question goes (decisions-as-questions, ADR decision
 * 7), by the question's state. The record is what the package's `answerQuestionRecord`
 * applies; this only routes the answer to what acts on it:
 *
 *   - waiting, its session alive (a set time): told to that session, which goes on;
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
}

export async function answerOneQuestion(
  deps: QuestionAnswerDeps,
  id: string,
  text: string,
): Promise<QuestionAnswered> {
  const before = deps.find(id);
  if (!before) throw new Error(`no question ${id}`);
  if (before.state === "answered" || before.state === "answered-late") {
    throw new Error(`question ${id} was already answered`);
  }
  if (!text.trim())
    throw new Error("a reply needs words: an empty reply is not an answer");
  let via: QuestionAnswered["via"];
  if (before.state === "went-ahead") via = "late";
  else if (before.session) via = "session";
  else via = "resume";
  if (via === "session" && before.session) {
    deps.tellSession(
      before.session.id,
      before.session.requestId,
      text.trim(),
      before.text,
    );
  }
  const question = deps.record(id, text);
  deps.decision({
    decision: `${id}: ${before.text}`,
    answer: text.trim(),
    by: "person",
    at: (deps.now?.() ?? new Date()).toISOString(),
  });
  if (via === "resume") {
    try {
      await deps.resume();
    } catch {
      // The answer is kept; a run that is already going tells the agent on its next step.
    }
  }
  return { question, via };
}
