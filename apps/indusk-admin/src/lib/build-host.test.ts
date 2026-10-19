// promise: an-accepted-brief-is-planned-unasked
// promise: approval-waits-for-a-finished-plan

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
  acceptedAt: string | null;
  unapprovedLooks: string[];
}

let held: Held;
let runs = 0;
let finishRun: () => void = () => {};
let failRun: (why: string) => void = () => {};
let handed: { onStep: (step: string) => void } | null = null;

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
    runPlanning: (deps: { onStep: (step: string) => void }) => {
      runs += 1;
      handed = deps;
      return new Promise((resolve) => {
        finishRun = () => resolve({ step: "ready-for-approval" });
        failRun = (why: string) => resolve({ step: "cannot-continue", why });
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

import * as host from "./build-host";
import { planningState, startBuild, startPlanning } from "./build-host";

const PROJECT = "seats";
const PLAN = "plan-from-brief";
const ACCEPTED_AT = "2026-10-19T12:00:00.000Z";
const BEGAN_BEFORE = "2026-10-19T11:00:00.000Z";
const BEGAN_AFTER = "2026-10-19T13:00:00.000Z";

beforeEach(() => {
  held = {
    briefStatus: "accepted",
    acceptedAt: ACCEPTED_AT,
    unapprovedLooks: [],
  };
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

describe("A19 — the end of a planning conversation asks for the planning run", () => {
  const ended = () =>
    (
      host as unknown as {
        planningConversationEnded?: (
          project: string,
          plan: string,
          startedAt: string,
        ) => Promise<unknown>;
      }
    ).planningConversationEnded;

  it("A19 is a function the sessions route can hand the manager as a session's end", () => {
    expect(typeof ended()).toBe("function");
  });

  it("A19 starts the run for an accepted brief whose looks are all approved", async () => {
    await ended()?.(PROJECT, PLAN, BEGAN_BEFORE);
    expect(runs).toBe(1);
  });

  it("A19 starts nothing for a draft brief or a look still unapproved", async () => {
    held.briefStatus = "draft";
    await ended()?.(PROJECT, PLAN, BEGAN_BEFORE);
    held.briefStatus = "accepted";
    held.unapprovedLooks = ["seat-picker is still proposed"];
    await ended()?.(PROJECT, PLAN, BEGAN_BEFORE);
    expect(typeof ended()).toBe("function");
    expect(runs).toBe(0);
  });

  it("A19 never throws when the ask is declined or refused", async () => {
    expect(typeof ended()).toBe("function");
    await startPlanning(PROJECT, PLAN);
    await expect(ended()?.(PROJECT, PLAN, BEGAN_BEFORE)).resolves.not.toThrow();
  });
});

describe("T22 — only the conversation that accepted the brief starts the run", () => {
  const ended = () =>
    (
      host as unknown as {
        planningConversationEnded: (
          project: string,
          plan: string,
          startedAt: string,
        ) => Promise<unknown>;
      }
    ).planningConversationEnded;

  // clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance
  // promise: an-accepted-brief-is-planned-unasked
  it("T22 starts nothing when the brief was accepted before the conversation began", async () => {
    await ended()(PROJECT, PLAN, BEGAN_AFTER);
    expect(runs).toBe(0);
  });

  it("T22 starts nothing for a brief accepted by hand, with no acceptance time", async () => {
    held.acceptedAt = null;
    await ended()(PROJECT, PLAN, BEGAN_BEFORE);
    expect(runs).toBe(0);
  });

  it("T22 starts the run when the brief was accepted during the conversation", async () => {
    await ended()(PROJECT, PLAN, BEGAN_BEFORE);
    expect(runs).toBe(1);
  });
});

describe("T21 — a held build session blocks every start", () => {
  it("T21 refuses a build start and a planning start, naming the session", async () => {
    open.push({ kind: "build", id: "sess-1" } as { kind: string });
    await expect(startBuild(PROJECT, PLAN)).rejects.toThrow(
      /sess-1 — stop it first/,
    );
    await expect(startPlanning(PROJECT, PLAN)).rejects.toThrow(
      /sess-1 — stop it first/,
    );
    expect(runs).toBe(0);
  });
});

describe("A12 — the admin holds a planning run as going until it ends", () => {
  it("A12 stays going through the gap between one step and the next, and reads stopped with its reason after a failure", async () => {
    await startPlanning(PROJECT, PLAN);
    handed?.onStep("plan-test-plan");
    expect(planningState(PROJECT, PLAN)).toMatchObject({
      running: true,
      step: "plan-test-plan",
    });
    // The gap: no step has been announced since, and the run has not ended.
    expect(planningState(PROJECT, PLAN)?.running).toBe(true);
    failRun("the last step's session failed: exit 1");
    await vi.waitFor(() =>
      expect(planningState(PROJECT, PLAN)?.running).toBe(false),
    );
    expect(planningState(PROJECT, PLAN)?.stop).toEqual({
      step: "cannot-continue",
      why: "the last step's session failed: exit 1",
    });
  });
});
