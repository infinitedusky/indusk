// promise: an-accepted-brief-is-planned-unasked

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * a-brief-is-planned-unasked T2 (A2): a planning run starts for an accepted
 * brief whose looks are all approved, waits while one is not, and starts when
 * the last is approved. What the plan holds is a fake read; the package's
 * `nextPlanningStep` is the real decision, so this tests the host's use of it,
 * not a copy of it. The runner and the session host are stood in for.
 */

interface Held {
  briefStatus: string | null;
  unapprovedLooks: string[];
}

let held: Held;
let runs = 0;
let finishRun: () => void = () => {};

const WRITTEN = { exists: false, ok: false };

vi.mock("@infinitedusky/indusk-mcp/build", async () => {
  const actual = await vi.importActual<
    typeof import("@infinitedusky/indusk-mcp/build")
  >("@infinitedusky/indusk-mcp/build");
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
      ...held,
    }),
    runPlanning: () => {
      runs += 1;
      return new Promise((resolve) => {
        finishRun = () => resolve({ step: "ready-for-approval" });
      });
    },
  };
});
vi.mock("@infinitedusky/indusk-mcp/plans", () => ({
  acceptPlan: async () => {},
}));
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => () => {},
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => "/p" }));

import { startBuild, startPlanning } from "./build-host";

const PROJECT = "seats";
const PLAN = "plan-from-brief";

beforeEach(() => {
  held = { briefStatus: "accepted", unapprovedLooks: [] };
  runs = 0;
  finishRun();
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.builds")]?.clear();
  g[Symbol.for("indusk.admin.plannings")]?.clear();
});

describe("A2 — a planning run starts when the brief is ready", () => {
  it("A2 starts for an accepted brief whose looks are all approved", async () => {
    const state = await startPlanning(PROJECT, PLAN);
    expect(state.started).toBe(true);
    expect(runs).toBe(1);
  });

  it("A2 waits while a look is not approved, starting nothing", async () => {
    held.unapprovedLooks = ["seat-picker is still proposed"];
    const state = await startPlanning(PROJECT, PLAN);
    expect(state.started).toBe(false);
    expect(state.stop?.step).toBe("wait-for-looks");
    expect(runs).toBe(0);
  });

  it("A2 starts when the last look is approved", async () => {
    held.unapprovedLooks = ["seat-picker is still proposed"];
    await startPlanning(PROJECT, PLAN);
    held.unapprovedLooks = [];
    const state = await startPlanning(PROJECT, PLAN);
    expect(state.started).toBe(true);
    expect(runs).toBe(1);
  });

  it("A2 starts nothing for a brief that is still a draft", async () => {
    held.briefStatus = "draft";
    const state = await startPlanning(PROJECT, PLAN);
    expect(state.started).toBe(false);
    expect(runs).toBe(0);
  });

  it("A2 starts no second run while one runs", async () => {
    await startPlanning(PROJECT, PLAN);
    await expect(startPlanning(PROJECT, PLAN)).rejects.toThrow(/already/);
    expect(runs).toBe(1);
  });

  it("A2 refuses to start a run or a build from inside a planning step", async () => {
    vi.stubEnv("INDUSK_BUILD_STEP", "plan-impl");
    try {
      await expect(startPlanning(PROJECT, PLAN)).rejects.toThrow(/plan-impl/);
      await expect(startBuild(PROJECT, PLAN)).rejects.toThrow(/plan-impl/);
      expect(runs).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
