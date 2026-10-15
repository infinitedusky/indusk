import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// promise: a-project-starts-as-a-conversation

/**
 * new-project-flow A2, the route half: the first message, with the documents
 * added, starts a conversation with the agent that holds both. The session
 * host is stood in for (as `promise-fix-route.test.ts` does) so no `claude`
 * starts; the draft is the package's own, written to a temporary
 * `INDUSK_HOME`, so what the agent is told and what is on disk are the real
 * ones.
 */

const started: Array<Record<string, unknown>> = [];
/** What the draft's transcript subscribes to the session: the manager replays and then hears events. */
let heard: ((ev: unknown) => void) | undefined;

vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  refuse: (status: number, message: string) =>
    Response.json({ error: message }, { status }),
  sessionManager: () => ({
    forPlan: () => undefined,
    capRefusal: () => undefined,
    subscribe: (_id: string, listen: (ev: unknown) => void) => {
      heard = listen;
      return () => {};
    },
    start: (opts: Record<string, unknown>) => {
      started.push(opts);
      return { id: "s-1", session: { pid: 4242 } };
    },
  }),
}));

let home: string;
const previousHome = process.env.INDUSK_HOME;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "new-project-routes-"));
  process.env.INDUSK_HOME = home;
  started.length = 0;
});

afterEach(() => {
  if (previousHome === undefined) {
    delete process.env.INDUSK_HOME;
  } else {
    process.env.INDUSK_HOME = previousHome;
  }
  rmSync(home, { recursive: true, force: true });
});

const brief = {
  name: "brief.md",
  content: "# Homework Gate\n\nA child's devices stay locked until homework is done.\n",
};

const jsonRequest = (body: unknown) =>
  new NextRequest("http://127.0.0.1:3996/api/new-projects", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3996",
      origin: "http://127.0.0.1:3996",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("A2 — the first message starts a conversation that holds it and the documents", () => {
  it("A2 starts a planning session for new-project:<id> whose prompt carries the message, with the document in the draft", async () => {
    mkdirSync(home, { recursive: true });
    const { POST } = await import("@/app/api/new-projects/route");
    const res = await POST(
      jsonRequest({ message: "A parental control system", documents: [brief] }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(started[0]).toMatchObject({ kind: "planning", plan: `new-project:${id}` });
    expect(String(started[0]?.prompt)).toContain("A parental control system");
    expect(readdirSync(join(home, "new-projects", id, "documents"))).toEqual(["brief.md"]);
    expect(
      readFileSync(join(home, "new-projects", id, "documents", "brief.md"), "utf-8"),
    ).toBe(brief.content);
    // The conversation is kept in the draft as it is said (ADR decision 9).
    heard?.({ type: "text", text: "Three things are open." });
    expect(
      readFileSync(join(home, "new-projects", id, "transcript.jsonl"), "utf-8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l)),
    ).toEqual([
      { type: "session", id: "s-1" },
      { type: "text", text: "Three things are open." },
    ]);
  });
});
