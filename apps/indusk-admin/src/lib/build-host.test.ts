// promise: an-accepted-brief-is-planned-unasked

import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const open: Array<{ kind: string }> = [];
const admitted = new Set<string>();
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({
    forPlan: (_project: string, _plan: string, kind?: string) =>
      open.find((r) => kind === undefined || r.kind === kind),
    // A set, as the real manager's: a second admit shares the first's place.
    admitBuild: (project: string, plan: string) => {
      admitted.add(`${project}/${plan}`);
      return () => {
        admitted.delete(`${project}/${plan}`);
      };
    },
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => "/p" }));

import { startBuild, startPlanning } from "./build-host";

const PROJECT = "seats";
const PLAN = "plan-from-brief";

beforeEach(() => {
  held = { briefStatus: "accepted", unapprovedLooks: [] };
  runs = 0;
  open.length = 0;
  admitted.clear();
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

describe("A11 — two asks at once start one planning run", () => {
  it("A11 starts one run when two asks arrive together", async () => {
    const asks = await Promise.allSettled([
      startPlanning(PROJECT, PLAN),
      startPlanning(PROJECT, PLAN),
    ]);
    expect(runs).toBe(1);
    const started = asks.filter(
      (a) => a.status === "fulfilled" && a.value.started,
    );
    expect(started).toHaveLength(1);
  });

  it("A11 holds one place for the run it started, not released by a refused second ask", async () => {
    await Promise.allSettled([
      startPlanning(PROJECT, PLAN),
      startPlanning(PROJECT, PLAN),
    ]);
    expect(admitted.has(`${PROJECT}/${PLAN}`)).toBe(true);
  });
});

describe("A12 — no planning run while a person's planning conversation is open", () => {
  it("A12 declines to start while a planning-kind session is open on the plan", async () => {
    open.push({ kind: "planning" });
    const outcome = await startPlanning(PROJECT, PLAN).then(
      (state) => state,
      (err: Error) => err,
    );
    expect(runs).toBe(0);
    const stop = outcome instanceof Error ? null : outcome.stop;
    const text =
      outcome instanceof Error
        ? outcome.message
        : stop && "why" in stop
          ? stop.why
          : "";
    expect(text).toMatch(/planning/i);
  });

  it("A12 tells the planning conversation, in the planner skill, to stop once the admin is planning", () => {
    const skill = readFileSync(
      join(process.cwd(), "..", "indusk-mcp", "skills", "planner.md"),
      "utf-8",
    );
    expect(skill).toMatch(/end (this|the) conversation here/i);
    expect(skill).toMatch(/admin[^\n]*(writes|is writing|plans)/i);
  });
});
