// promise: decisions-wait-in-one-place
import type { Question } from "@infinitedusky/indusk-mcp/questions";
import { describe, expect, it } from "vitest";
import { openQuestions, whenOf } from "./question-view";

const NOW = 10_000_000;
const q = (over: Partial<Question>): Question => ({
  id: "q",
  plan: "p",
  text: "t",
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

describe("question rows", () => {
  it("open questions are expensive first, then oldest; answered ones are not open", () => {
    const out = openQuestions([
      q({ id: "c2", askedAt: 2 }),
      q({ id: "e", cost: "expensive", askedAt: 9 }),
      q({ id: "c1", askedAt: 1 }),
      q({ id: "done", state: "answered" }),
      q({ id: "went", state: "went-ahead", askedAt: 3 }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["e", "c1", "c2", "went"]);
  });

  it("the time words: a timer counts down, a hold has none, a gone-ahead one says how long ago", () => {
    expect(whenOf(q({ dueAt: NOW + 4 * 60_000 }), NOW)).toBe(
      "goes ahead in 4 min",
    );
    expect(whenOf(q({ cost: "expensive" }), NOW)).toBe(
      "the build is stopped until you answer",
    );
    expect(whenOf(q({}), NOW)).toBe("waiting for you; no timer");
    expect(
      whenOf(q({ state: "went-ahead", wentAheadAt: NOW - 12 * 60_000 }), NOW),
    ).toBe("12 min ago");
  });
});
