// clause: a-brief-is-accepted-on-current-main/main-is-merged-first
// clause: a-brief-is-accepted-on-current-main/a-conflict-refuses
// promise: an-accepted-brief-is-planned-unasked

import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefText } from "../../../indusk-mcp/src/__tests__/helpers/plan-fixture";
import {
  type PlanLifecycleProject,
  planLifecycleProject,
} from "../../../indusk-mcp/src/__tests__/helpers/plan-lifecycle-fixture";
import { git } from "../../../indusk-mcp/src/__tests__/helpers/test-git";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1: the admin's planning start
 * brings main into the plan's branch before its first step, so a brief
 * accepted by hand, or a run held for looks, is still planned on current main;
 * a conflict stops the run and the route answers with the refusal. Real git in
 * a temporary repository; the package's plan functions are the real ones, and
 * the runner and the session host are stood in for.
 */

const PROJECT = "seats";
const PLAN = "seat-holds";
const briefPath = ".indusk/planning/seat-holds/brief.md";

let trunk = "";
let wt = "";
const runs: Array<{ sawMainFile: boolean }> = [];

vi.mock("@infinitedusky/indusk-mcp/build", async () => {
  const actual = await vi.importActual<
    typeof import("@infinitedusky/indusk-mcp/build")
  >("@infinitedusky/indusk-mcp/build");
  const WRITTEN = { exists: false, ok: false };
  return {
    ...actual,
    autoAccepts: () => false,
    buildStepModel: async () => null,
    readBuildPlan: async () => ({}),
    runStepSession: async () => ({ error: null }),
    runBuild: async () => ({ step: "review", why: "waits for the person" }),
    runRelease: async () => ({ released: true, error: null }),
    readPlanningState: async () => ({
      required: ["brief", "test-plan", "adr", "impl"],
      documents: { "test-plan": WRITTEN, adr: WRITTEN, impl: WRITTEN },
      implStatus: null,
      contractOk: true,
      blocker: null,
      briefStatus: "accepted",
      acceptedAt: "2026-10-19T12:00:00.000Z",
      unapprovedLooks: [],
    }),
    runPlanning: async () => {
      runs.push({
        sawMainFile: existsSync(join(wt, "docs", "from-main.md")),
      });
      return { step: "ready-for-approval" };
    },
  };
});
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: trunk, cwd: wt }),
  adminOnly: () => null,
  refuse: (status: number, error: string) =>
    Response.json({ error }, { status }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => () => {},
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => trunk }));

import { POST } from "../app/api/plans/plan/route";
import { planningConversationEnded, startPlanning } from "./build-host";

let p: PlanLifecycleProject;
beforeEach(() => {
  runs.length = 0;
  p = planLifecycleProject("build-host-trunk");
  trunk = p.trunk;
  wt = p.makeWorktree(PLAN);
  p.commit(
    wt,
    {
      [briefPath]: briefText(PLAN).replace("status: accepted", "status: draft"),
    },
    "the brief",
  );
  // Accepted by hand, as an agent that only follows the skill's advice might.
  p.commit(wt, { [briefPath]: briefText(PLAN) }, "brief accepted by hand");
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.builds")]?.clear();
  g[Symbol.for("indusk.admin.plannings")]?.clear();
});
afterEach(() => {
  p.cleanup();
});

/** The branch and main change the same line of one file. */
function conflict(): void {
  p.commit(trunk, { "docs/notes.md": "a\nb\nc\n" }, "notes");
  git(wt, ["merge", "-q", "main"]);
  p.commit(wt, { "docs/notes.md": "a\nmine\nc\n" }, "mine");
  p.commit(trunk, { "docs/notes.md": "a\ntheirs\nc\n" }, "theirs");
}

describe("the planning start brings main in", () => {
  it("A7: a brief accepted by hand on a branch behind main is planned in a worktree holding main's newest commit", async () => {
    p.commit(trunk, { "docs/from-main.md": "main\n" }, "main moves");
    const state = await startPlanning(PROJECT, PLAN);
    expect(state.started).toBe(true);
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0].sawMainFile).toBe(true);
  });

  it("A8: a conflicting merge stops the run before any step, naming the file, the branch as it was", async () => {
    conflict();
    const head = git(wt, ["rev-parse", "HEAD"]);
    await expect(startPlanning(PROJECT, PLAN)).rejects.toThrow(
      /docs\/notes\.md/,
    );
    expect(runs).toHaveLength(0);
    expect(git(wt, ["rev-parse", "HEAD"])).toBe(head);
    expect(git(wt, ["status", "--porcelain"])).toBe("");
  });

  it("A14: the planning route answers a conflicting plan with 409 and the refusal as `error`", async () => {
    conflict();
    const res = await POST(
      new NextRequest("http://localhost/api/plans/plan", {
        method: "POST",
        body: JSON.stringify({ project: PROJECT, plan: PLAN }),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("docs/notes.md");
    expect(body.error).toContain("nothing was changed");
  });
});

describe("the end of the accepting conversation starts the run once", () => {
  it("A21: a conversation that accepted the brief starts one run, in a worktree holding main's new file", async () => {
    p.commit(trunk, { "docs/from-main.md": "main\n" }, "main moves");
    const state = await planningConversationEnded(
      PROJECT,
      PLAN,
      "2026-10-19T11:00:00.000Z",
    );
    expect(state?.started).toBe(true);
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0].sawMainFile).toBe(true);
  });

  it("A22: a conflicting plan's conversation end starts no run", async () => {
    conflict();
    const state = await planningConversationEnded(
      PROJECT,
      PLAN,
      "2026-10-19T11:00:00.000Z",
    );
    expect(state).toBeNull();
    expect(runs).toHaveLength(0);
  });
});
