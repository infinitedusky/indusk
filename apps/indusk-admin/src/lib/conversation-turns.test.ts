import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { describe, expect, it } from "vitest";
import { historyBefore, turnsOf } from "./conversation-turns";

// promise: a-project-conversation-is-a-back-and-forth

/**
 * new-project-flow A23: a session's events read as alternating you/agent
 * turns. An agent turn's reply is its last text; the tools and the text before
 * it are its working; a question or permission nobody answered is waiting.
 */

const tool = (name: string, file: string): StartedEvent => ({
  type: "tool",
  name,
  input: { file_path: file },
});
const text = (t: string): StartedEvent => ({ type: "text", text: t });
const result = (t: string): StartedEvent => ({
  type: "result",
  ok: true,
  subtype: "success",
  text: t,
  sessionId: "s",
});

describe("A23 — events read as alternating turns", () => {
  it("A23 an agent turn's reply is its last text; the tools and earlier text are its working", () => {
    const turns = turnsOf([
      tool("Read", "planner.md"),
      text("Reading the brief."),
      text("Three things are open."),
      result("Three things are open."),
      { type: "you", text: "A phone app." },
      text("Got it."),
      result("Got it."),
    ]);
    expect(turns).toHaveLength(3);
    expect(turns[0]).toMatchObject({
      who: "agent",
      reply: "Three things are open.",
      working: ["Read planner.md", "Reading the brief."],
      waiting: [],
    });
    expect(turns[1]).toEqual({ who: "you", text: "A phone app." });
    expect(turns[2]).toMatchObject({
      who: "agent",
      reply: "Got it.",
      working: [],
    });
  });

  it("A23 a turn with no text replies with its result's text", () => {
    const turns = turnsOf([
      tool("Write", "brief.md"),
      result("Wrote the brief."),
    ]);
    expect(turns).toMatchObject([
      { who: "agent", reply: "Wrote the brief.", working: ["Write brief.md"] },
    ]);
  });

  it("A23 an unanswered question is waiting, not working", () => {
    const turns = turnsOf([
      text("One thing first."),
      {
        type: "question",
        requestId: "r1",
        questions: [{ question: "Where?", options: [{ label: "Fly" }] }],
        input: {},
      },
    ]);
    expect(turns).toHaveLength(1);
    const turn = turns[0];
    expect(turn).toMatchObject({ who: "agent", reply: "One thing first." });
    expect(
      turn?.who === "agent" ? turn.waiting.map((w) => w.requestId) : [],
    ).toEqual(["r1"]);
  });
});

describe("historyBefore — what the transcript holds that the page is not hearing live", () => {
  const kept = [
    { type: "session", id: "a" },
    text("first"),
    { type: "exit", code: 0, stderr: "" },
    { type: "session", id: "b" },
    text("second"),
    { type: "fold-opened", at: "2026-10-14T10:00:00.000Z" },
  ] as const;

  it("drops the session the page is connected to, and the transcript's own lines", () => {
    expect(historyBefore([...kept], "b")).toEqual([
      text("first"),
      { type: "exit", code: 0, stderr: "" },
    ]);
  });

  it("keeps every event when no session is connected", () => {
    expect(historyBefore([...kept], null)).toHaveLength(3);
  });
});
