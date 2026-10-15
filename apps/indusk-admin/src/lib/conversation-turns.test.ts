import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { describe, expect, it } from "vitest";
import { historyBefore, marks, turnsOf } from "./conversation-turns";

// promise: a-project-conversation-is-a-back-and-forth
// promise: a-prompt-shows-only-when-a-person-must-choose

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

describe("A29 — every agent turn carries one status", () => {
  const statusOf = (turn: ReturnType<typeof turnsOf>[number] | undefined) =>
    turn?.who === "agent" ? turn.status : undefined;

  it("A29 a turn is working while its agent runs without a reply, and appears before any text", () => {
    expect(statusOf(turnsOf([], { running: true })[0])).toBe("working");
    expect(
      statusOf(turnsOf([tool("Read", "planner.md")], { running: true })[0]),
    ).toBe("working");
    const after = turnsOf([{ type: "you", text: "Fly." }], { running: true });
    expect(after.map((t) => t.who)).toEqual(["you", "agent"]);
    expect(statusOf(after[1])).toBe("working");
  });

  it("A29 a turn is done once it has replied", () => {
    expect(
      statusOf(turnsOf([text("Hi."), result("Hi.")], { running: true })[0]),
    ).toBe("done");
    expect(
      statusOf(turnsOf([text("Hi."), result("Hi.")], { running: false })[0]),
    ).toBe("done");
  });

  it("A29 a turn is stopped when its agent ended before replying", () => {
    const ended: StartedEvent[] = [
      tool("Read", "planner.md"),
      { type: "exit", code: 1, stderr: "" },
    ];
    expect(statusOf(turnsOf(ended, { running: false })[0])).toBe("stopped");
    const earlier = turnsOf(
      [
        tool("Read", "a.md"),
        { type: "you", text: "Go on." },
        text("Ok."),
        result("Ok."),
      ],
      { running: true },
    );
    expect(statusOf(earlier[0])).toBe("stopped");
    expect(statusOf(earlier[2])).toBe("done");
    expect(turnsOf([], { running: false })).toEqual([]);
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

  // The words a person restarts the agent with are written after the new
  // session's marker but never heard by the manager, so nothing replays them:
  // without this each message showed only after the next one was sent.
  it("keeps the words the connected session was started with, in order", () => {
    const restarted = [
      ...kept,
      { type: "exit", code: 1, stderr: "" },
      { type: "session", id: "c" },
      { type: "you", text: "this is a test" },
      text("heard live"),
    ] as const;
    const history = historyBefore([...restarted], "c");
    expect(history.at(-1)).toEqual({ type: "you", text: "this is a test" });
    expect(history).not.toContainEqual(text("heard live"));
  });

  it("knows whether the transcript has marked a session yet", () => {
    expect(marks([...kept], "b")).toBe(true);
    expect(marks([...kept], "c")).toBe(false);
    expect(marks([...kept], null)).toBe(false);
  });
});

describe("decided-prompts-stay-closed A4 — a request its rule decided is not waiting", () => {
  it("A4 a permission with a decided event lists nothing waiting, with no answered set handed in", () => {
    const turns = turnsOf([
      {
        type: "permission",
        requestId: "p1",
        tool: "Write",
        input: { file_path: "/w/a.ts" },
      },
      // Built loosely so this file loads before the `decided` type exists.
      {
        type: "decided",
        requestId: "p1",
        allow: true,
        by: "rule",
      } as unknown as StartedEvent,
    ]);
    const agent = turns.find((t) => t.who === "agent");
    expect(agent).toMatchObject({ waiting: [] });
  });
});
