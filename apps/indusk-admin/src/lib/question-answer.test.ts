// promise: decisions-wait-in-one-place
import type { Question } from "@infinitedusky/indusk-mcp/questions";
import { describe, expect, it } from "vitest";
import { answerOneQuestion, type QuestionAnswerDeps } from "./question-answer";

/**
 * decisions-as-questions: an answer goes where the question's state sends it —
 * a live session is told, a held question restarts the run, a late answer is recorded —
 * and an empty reply or an answered question is refused.
 */
const q = (over: Partial<Question> = {}): Question => ({
  id: "q-1",
  plan: "p",
  text: "Which store?",
  options: [
    { label: "a", changes: [] },
    { label: "b", changes: [] },
  ],
  recommended: "a",
  reason: "r",
  statedCost: "cheap",
  cost: "cheap",
  askedAt: 0,
  dueAt: null,
  state: "waiting",
  ...over,
});

function deps(question: Question) {
  const calls: string[] = [];
  const d: QuestionAnswerDeps = {
    find: (id) => (id === question.id ? question : undefined),
    record: (id, text) => {
      calls.push(`record ${id} ${text}`);
      return {
        ...question,
        state: question.state === "went-ahead" ? "answered-late" : "answered",
        answer: text,
      };
    },
    tellSession: (s, r, text) => calls.push(`tell ${s}/${r} ${text}`),
    resume: async () => {
      calls.push("resume");
    },
    decision: (e) => calls.push(`decision ${e.answer}`),
    now: () => new Date("2026-10-19T12:00:00Z"),
  };
  return { d, calls };
}

describe("answerOneQuestion", () => {
  it("a held question is recorded and the run starts again", async () => {
    const { d, calls } = deps(q());
    const out = await answerOneQuestion(d, "q-1", " b ");
    expect(out.via).toBe("resume");
    expect(calls).toEqual(["record q-1  b ", "decision b", "resume"]);
  });

  it("a question whose session lives is told to it, and the run is not restarted", async () => {
    const { d, calls } = deps(
      q({ dueAt: 5, session: { id: "s1", requestId: "r1" } }),
    );
    expect((await answerOneQuestion(d, "q-1", "b")).via).toBe("session");
    expect(calls[0]).toBe("tell s1/r1 b");
    expect(calls).not.toContain("resume");
  });

  it("a question that went ahead is answered late, without a restart", async () => {
    const { d, calls } = deps(q({ state: "went-ahead", done: "a" }));
    const out = await answerOneQuestion(d, "q-1", "b");
    expect(out).toMatchObject({
      via: "late",
      question: { state: "answered-late" },
    });
    expect(calls).not.toContain("resume");
  });

  it("refuses an empty reply, an answered question and an unknown one, recording nothing", async () => {
    const { d, calls } = deps(q());
    await expect(answerOneQuestion(d, "q-1", "  ")).rejects.toThrow(
      /empty reply/,
    );
    await expect(answerOneQuestion(d, "q-9", "b")).rejects.toThrow(
      /no question/,
    );
    const done = deps(q({ state: "answered", answer: "a" }));
    await expect(answerOneQuestion(done.d, "q-1", "b")).rejects.toThrow(
      /already answered/,
    );
    expect(calls).toEqual([]);
    expect(done.calls).toEqual([]);
  });
});
