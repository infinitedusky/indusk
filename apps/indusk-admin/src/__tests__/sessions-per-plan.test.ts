import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Session,
  SessionManager,
  type SessionOptions,
} from "@infinitedusky/indusk-mcp/session";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// promise: a-session-belongs-to-its-plan

/**
 * sessions-per-plan A4–A6: the admin's callers, against a real session manager
 * (a fake launcher in place of `claude`) installed where `session-host.ts`
 * reads it. A session for plan `one` runs; a start for another plan, a draft's
 * conversation, and the cockpit's waiting list must each work as if the other
 * plan's session were not theirs. Only the registry, the plan's location, the
 * draft store and the build runner are stood in for.
 */

const dirs: string[] = [];
const launched: Array<{ opts: SessionOptions }> = [];
/** Every answer a fake session received, by the kind of session that got it. */
const answered: Array<{ kind: string; requestId: string }> = [];

vi.mock("@/lib/registry-client", () => ({
  getProjectPath: () => "/mock/proj",
}));
vi.mock("@/lib/session-host", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/session-host")>()),
  adminOnly: () => null,
  planLocation: async () => ({ root: "/mock/proj", cwd: "/mock/proj" }),
}));
vi.mock("@infinitedusky/indusk-mcp/build", () => ({
  autoAccepts: () => false,
  buildStepModel: async () => null,
  planningStepRefusal: () => null,
  readBuildPlan: async () => ({}),
  runStepSession: async () => ({}),
  runBuild: async () => ({ step: "review", why: "waits for the person" }),
  runRelease: async () => ({ released: true, error: null }),
}));
vi.mock("@infinitedusky/indusk-mcp/drafts", async (importActual) => ({
  ...(await importActual<typeof import("@infinitedusky/indusk-mcp/drafts")>()),
  draftHomeOf: () => "/mock/home",
  findDraft: (_home: string, id: string) => ({ id, dir: dirs[0] }),
  touchDraft: () => {},
}));

import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { POST as talk } from "@/app/api/drafts/[id]/talk/route";
import { POST as startSession } from "@/app/api/sessions/route";
import { buildState, startBuild } from "@/lib/build-host";
import { answerDecision } from "@/lib/decisions";
import { readWaiting } from "@/lib/decisions-reader";
import type { Plan } from "@/lib/planning-reader";

const KEY = Symbol.for("indusk.admin.sessionManager");

function install(max?: number): SessionManager {
  const record = join(dirs[0] ?? tmpdir(), "admin-sessions.json");
  const manager = new SessionManager({
    recordPath: record,
    ...(max ? { max } : {}),
    start: (opts: SessionOptions): Session => {
      launched.push({ opts });
      return {
        pid: 40_000 + launched.length,
        kind: opts.kind,
        cwd: opts.cwd,
        say: () => {},
        answer: (ev) => {
          answered.push({ kind: opts.kind, requestId: ev.requestId });
        },
        decide: () => {},
        stop: async () => {},
        done: new Promise(() => {}),
      };
    },
  });
  (globalThis as unknown as Record<symbol, SessionManager>)[KEY] = manager;
  return manager;
}

const planning = (plan: string) => ({
  cwd: `/mock/proj-worktrees/${plan}`,
  kind: "planning" as const,
  prompt: "/planner",
  project: "proj",
  plan,
  onEvent: () => {},
});

beforeEach(() => {
  dirs.push(mkdtempSync(join(tmpdir(), "sessions-per-plan-")));
  launched.length = 0;
  answered.length = 0;
});
afterEach(() => {
  delete (globalThis as unknown as Record<symbol, unknown>)[KEY];
  (globalThis as unknown as Record<symbol, Map<string, unknown> | undefined>)[
    Symbol.for("indusk.admin.builds")
  ]?.clear();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("A4 — a draft's conversation starts while a plan's session runs", () => {
  it("A4 the talk route answers 201, not 409", async () => {
    const manager = install();
    manager.start(planning("one"));
    const res = await talk(
      new NextRequest("http://127.0.0.1:3996/api/drafts/d1/talk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: "proj" }),
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );
    expect(res.status).toBe(201);
    expect(manager.running()).toHaveLength(2);
  });
});

describe("A5 — a build of one plan is not refused for another plan's session", () => {
  it("A5 startBuild for plan two resolves while plan one has a session", async () => {
    install().start(planning("one"));
    await expect(startBuild("proj", "two")).resolves.toMatchObject({
      running: true,
    });
  });
});

describe("A6 — each plan's waiting entry shows its own session and question", () => {
  it("A6 two running sessions each asking give one waiting entry per plan, each with its own question", async () => {
    const manager = install();
    const plans = ["one", "two"].map(
      (name) =>
        ({
          name,
          status: "draft",
          archived: false,
          workflow: null,
          position: null,
        }) as unknown as Plan,
    );
    expect(() => manager.start(planning("one"))).not.toThrow();
    expect(() => manager.start(planning("two"))).not.toThrow();
    for (const { opts } of launched) {
      const own = opts.cwd.endsWith("/one") ? "one" : "two";
      opts.onEvent({
        type: "question",
        requestId: `req-${own}`,
        questions: [
          {
            question: `Which map for ${own}?`,
            options: [{ label: "A" }, { label: "B" }],
          },
        ],
        input: {},
      });
    }
    const waiting = await readWaiting("proj", dirs[0] ?? tmpdir(), plans);
    expect(waiting.map((w) => [w.plan, w.decision])).toEqual([
      ["one", "Which map for one?"],
      ["two", "Which map for two?"],
    ]);
  });
});

describe("A12 — a second session on the same plan offers to continue the running one", () => {
  it("A12 the refusal says this plan has one, asks to continue it here, and hands back its id", async () => {
    const manager = install();
    const { id } = manager.start(planning("one"));
    // A page is already showing it (Sandy, 2026-10-14: an unwatched session is
    // simply attached; the question is for one open elsewhere).
    manager.subscribe(id, () => {});
    const res = await startSession(
      new NextRequest("http://127.0.0.1:3996/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: "proj",
          plan: "one",
          kind: "planning",
          prompt: "/planner",
        }),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: string;
      running?: { id: string };
    };
    expect(body.error).toContain(
      "A planning session is already running on this plan",
    );
    expect(body.error).toContain("Do you want to continue that session here?");
    expect(body.running?.id).toBe(id);
    expect(manager.running()).toHaveLength(1);
  });
});

describe("A13 — an answer reaches the session that asked it", () => {
  it("A13 a question asked by the plan's planning session, with a build running first, is answered in the planning session", async () => {
    const manager = install();
    manager.start({ ...planning("one"), kind: "build", prompt: "/work" });
    manager.start(planning("one"));
    const asking = launched.find(({ opts }) => opts.kind === "planning");
    asking?.opts.onEvent({
      type: "question",
      requestId: "req-planning",
      questions: [
        {
          question: "Which map?",
          options: [{ label: "A" }, { label: "B" }],
        },
      ],
      input: {},
    });
    const waiting = {
      plan: "one",
      on: "question",
      step: "Brief",
      decision: "Which map?",
      accept: "A",
      alternative: "B",
      requestId: "req-planning",
    } as unknown as Waiting;
    await expect(
      answerDecision(
        {
          sessions: manager,
          where: async () => ({ cwd: "/mock/proj" }),
          approve: async () => ({}),
          release: async () => ({}),
          record: () => ({ commit: { committed: true } }),
        },
        "proj",
        waiting,
        { choice: "accept" },
      ),
    ).resolves.toMatchObject({ via: "question" });
    expect(answered).toEqual([{ kind: "planning", requestId: "req-planning" }]);
  });
});

describe("A14 — a new build at the cap is refused before it starts", () => {
  it("A14 startBuild with the machine at its cap throws the cap's refusal and starts no build", async () => {
    const manager = install(2);
    manager.start(planning("one"));
    manager.start(planning("two"));
    await expect(startBuild("proj", "three")).rejects.toThrow(
      /2 sessions are running \(sessions\.max\)/,
    );
    expect(buildState("proj", "three")).toBeNull();
  });
});
