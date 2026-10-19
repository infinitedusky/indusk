// clause: a-run-is-read-from-its-record/kept-on-disk
// clause: a-run-is-read-from-its-record/dead-reads-stopped
// promise: a-build-runs-to-review-unasked
// clause: a-run-is-read-from-its-record/released-only-when-landed
// promise: an-accepted-brief-is-planned-unasked

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookkeepingRoots } from "@infinitedusky/indusk-mcp/bookkeeping/roots";
import {
  type RunKind,
  type RunRecord,
  readRunRecord,
  realProcessReads,
  startRunRecord,
  writeRunRecord,
} from "@infinitedusky/indusk-mcp/run-record";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * a-run-can-be-trusted Build Phase 1: the admin keeps each run as a record on
 * disk and reads it back, so a restart loses nothing and a run whose process
 * is gone reads stopped and is started again by Build. The package's runner
 * and the session host are stood in for; the record, the liveness rule and
 * the restart rule are the package's real ones, over a temporary home.
 */

const priorHome = process.env.INDUSK_HOME;
const PROJECT = "seats";
const PLAN = "keeps-a-record";

interface Held {
  implStatus: string | null;
  accepted: boolean;
}

let held: Held;
let project: string;
let home: string;
let stepHold: Promise<{ error: null }>;
let endStep: () => void = () => {};
let finishBuild: (stop: unknown) => void = () => {};
let finishPlanning: (stop: unknown) => void = () => {};
let runs: { build: number; planning: number; release: number };
let handed: {
  build: {
    onStep: (u: unknown) => void;
    run: (...a: unknown[]) => Promise<unknown>;
  } | null;
  planning: {
    onStep: (s: string) => void;
    run: (...a: unknown[]) => Promise<unknown>;
  } | null;
} = { build: null, planning: null };

const identity = () => {
  const started = realProcessReads.startTime(process.pid);
  return {
    id: "sess-1",
    pid: process.pid,
    bin: process.execPath,
    cwd: "/p",
    project: PROJECT,
    plan: PLAN,
    kind: "build",
    startedAt: (started ?? new Date()).toISOString(),
  };
};

/** Whether the plan is on main, which a release reads from (stood in for; the rule is the package's). */
let onMain = true;
vi.mock("@infinitedusky/indusk-mcp/run-record", async () => {
  const actual = await vi.importActual<
    typeof import("@infinitedusky/indusk-mcp/run-record")
  >("@infinitedusky/indusk-mcp/run-record");
  return { ...actual, planLandedOnMain: () => onMain };
});

vi.mock("@infinitedusky/indusk-mcp/build", async () => {
  const actual = await vi.importActual<
    typeof import("@infinitedusky/indusk-mcp/build")
  >("@infinitedusky/indusk-mcp/build");
  return {
    ...actual,
    autoAccepts: () => false,
    buildStepModel: async () => null,
    readBuildPlan: async () => ({
      content: `---\nstatus: ${held.implStatus}\n${held.accepted ? "accepted: 2026-10-19T00:00:00.000Z\n" : ""}---\n`,
    }),
    nextBuildStep: () => ({ step: "work", phase: "Build Phase 2: second" }),
    nextPlanningStep: () => ({ step: "plan-adr" }),
    readPlanningState: async () => ({
      required: ["brief", "test-plan", "adr", "impl"],
      documents: {
        "test-plan": { exists: true, ok: true },
        adr: { exists: false, ok: false },
        impl: { exists: false, ok: false },
      },
      implStatus: held.implStatus,
      contractOk: true,
      unapprovedLooks: [],
      blocker: null,
      briefStatus: "accepted",
      acceptedAt: "2026-10-19T12:00:00.000Z",
    }),
    runStepSession: async (
      _step: string,
      opts: { onSession?: (r: unknown) => void },
    ) => {
      opts.onSession?.(identity());
      return stepHold;
    },
    runBuild: (deps: typeof handed.build) => {
      runs.build += 1;
      handed.build = deps;
      return new Promise((resolve) => {
        finishBuild = resolve;
      });
    },
    runPlanning: (deps: typeof handed.planning) => {
      runs.planning += 1;
      handed.planning = deps;
      return new Promise((resolve) => {
        finishPlanning = resolve;
      });
    },
    runRelease: async () => {
      runs.release += 1;
      return { released: true, error: null };
    },
  };
});
vi.mock("@infinitedusky/indusk-mcp/plans", () => ({
  acceptPlan: async () => {},
  bringTrunkIntoPlan: async () => undefined,
}));
/** What finding the plan's worktree waits on; resolved at once unless a test holds it. */
let whereHold: Promise<void> = Promise.resolve();
vi.mock("./session-host", () => ({
  planLocation: async () => {
    await whereHold;
    return { root: "/p", cwd: "/p" };
  },
  sessionManager: () => ({
    forPlan: () => undefined,
    running: () => [],
    admitBuild: () => () => {},
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => project }));

import {
  buildState,
  planningConversationEnded,
  planningState,
  startBuild,
  startPlanning,
  startRelease,
} from "./build-host";

const forget = () => {
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.builds")]?.clear();
  g[Symbol.for("indusk.admin.plannings")]?.clear();
};

const deadRecord = (
  kind: RunKind,
  over: Partial<RunRecord> = {},
): RunRecord => ({
  ...startRunRecord(PLAN, kind, "2026-10-19T09:00:00.000Z"),
  step: "work",
  phase: "Build Phase 2: second",
  // A process that is not running: a pid no live program holds.
  process: {
    pid: 2 ** 22 + 7,
    bin: "claude",
    startedAt: "2026-10-19T09:00:01.000Z",
  },
  ...over,
});

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "build-host-record-"));
  mkdirSync(join(project, ".indusk"), { recursive: true });
  process.env.INDUSK_HOME = mkdtempSync(
    join(tmpdir(), "build-host-record-home-"),
  );
  home = bookkeepingRoots(project).home;
  held = { implStatus: "in-progress", accepted: false };
  onMain = true;
  runs = { build: 0, planning: 0, release: 0 };
  handed = { build: null, planning: null };
  whereHold = Promise.resolve();
  stepHold = new Promise((resolve) => {
    endStep = () => resolve({ error: null });
  });
  forget();
});

afterEach(() => {
  endStep();
  finishBuild({ step: "review" });
  finishPlanning({ step: "ready-for-approval" });
  forget();
  rmSync(project, { recursive: true, force: true });
  rmSync(process.env.INDUSK_HOME ?? "", { recursive: true, force: true });
  if (priorHome === undefined) delete process.env.INDUSK_HOME;
  else process.env.INDUSK_HOME = priorHome;
});

const readRecord = (kind: RunKind) => readRunRecord(home, PLAN, kind);

describe("A1 — a started run leaves its record before its first step finishes", () => {
  it("A1 a build, a planning run and a release each have a record naming plan, kind and process", async () => {
    await startBuild(PROJECT, PLAN);
    await handed.build?.onStep({
      kind: "step",
      step: "work",
      detail: "Build Phase 2: second",
    });
    void handed.build?.run("work", "Build Phase 2: second");
    await vi.waitFor(() =>
      expect(readRecord("build")).toMatchObject({
        plan: PLAN,
        kind: "build",
        step: "work",
        phase: "Build Phase 2: second",
        process: { pid: process.pid },
      }),
    );
    await startPlanning(PROJECT, "other-plan");
    expect(readRunRecord(home, "other-plan", "planning")).toMatchObject({
      kind: "planning",
      stop: null,
    });
    await startRelease(PROJECT, "third-plan");
    expect(readRunRecord(home, "third-plan", "release")).toMatchObject({
      kind: "release",
    });
  });
});

describe("A3 — after the admin forgets, the page shows the same step, phase and state", () => {
  it("A3 a build reads the same from its record alone while its step session lives", async () => {
    await startBuild(PROJECT, PLAN);
    handed.build?.onStep({
      kind: "step",
      step: "work",
      detail: "Build Phase 2: second",
    });
    void handed.build?.run("work", "Build Phase 2: second");
    await vi.waitFor(() =>
      expect(readRecord("build")).toMatchObject({
        process: { pid: process.pid },
      }),
    );
    const before = buildState(PROJECT, PLAN);
    forget();
    const after = buildState(PROJECT, PLAN);
    expect(before).toMatchObject({
      running: true,
      step: "work",
      detail: "Build Phase 2: second",
    });
    expect(after).toEqual(before);
  });

  it("A3 a planning run reads the same from its record alone", async () => {
    held.implStatus = "draft";
    await startPlanning(PROJECT, PLAN);
    handed.planning?.onStep("plan-adr");
    void handed.planning?.run("plan-adr");
    await vi.waitFor(() =>
      expect(readRecord("planning")).toMatchObject({
        process: { pid: process.pid },
      }),
    );
    const before = planningState(PROJECT, PLAN);
    forget();
    expect(planningState(PROJECT, PLAN)).toMatchObject({
      running: true,
      step: before?.step,
    });
    expect(before).toMatchObject({ running: true, step: "plan-adr" });
  });

  it("A18 a release that ended cleanly while the plan is not on main reads stopped, never released", async () => {
    onMain = false;
    await startRelease(PROJECT, PLAN);
    await vi.waitFor(() =>
      expect(buildState(PROJECT, PLAN)?.running).toBe(false),
    );
    const shown = buildState(PROJECT, PLAN);
    expect(shown?.release?.released).toBe(false);
    expect(shown?.stop).toMatchObject({
      step: "release-failed",
      why: expect.stringContaining("not on main"),
    });
    forget();
    expect(buildState(PROJECT, PLAN)?.release?.released).toBe(false);
  });

  it("A3 a release that ended reads released from its record alone", async () => {
    await startRelease(PROJECT, PLAN);
    await vi.waitFor(() =>
      expect(buildState(PROJECT, PLAN)?.running).toBe(false),
    );
    const before = buildState(PROJECT, PLAN);
    forget();
    expect(buildState(PROJECT, PLAN)).toEqual(before);
    expect(before?.release).toEqual({ released: true, error: null });
  });
});

describe("A4 — a run that ends on its own has its stop written, and the page keeps it", () => {
  it("A4 a build that stopped at review reads that after a restart", async () => {
    await startBuild(PROJECT, PLAN);
    finishBuild({ step: "review" });
    await vi.waitFor(() =>
      expect(buildState(PROJECT, PLAN)?.running).toBe(false),
    );
    expect(readRecord("build")).toMatchObject({ stop: { step: "review" } });
    forget();
    expect(buildState(PROJECT, PLAN)).toMatchObject({
      running: false,
      stop: { step: "review" },
    });
  });

  it("A4 a build that could not continue keeps its reason", async () => {
    await startBuild(PROJECT, PLAN);
    finishBuild({
      step: "cannot-continue",
      why: "two steps in a row made no progress",
    });
    await vi.waitFor(() =>
      expect(buildState(PROJECT, PLAN)?.running).toBe(false),
    );
    forget();
    expect(buildState(PROJECT, PLAN)?.stop).toEqual({
      step: "cannot-continue",
      why: "two steps in a row made no progress",
    });
  });
});

describe("A12 — a dead record never blocks Build; a live run still does", () => {
  it("A12 a build whose process is gone reads stopped, saying so, and is not refused", async () => {
    writeRunRecord(home, deadRecord("build"));
    const shown = buildState(PROJECT, PLAN);
    expect(shown?.running).toBe(false);
    expect(shown?.stop).toMatchObject({
      step: "cannot-continue",
      why: expect.stringContaining("gone"),
    });
    await expect(startBuild(PROJECT, PLAN)).resolves.toMatchObject({
      running: true,
    });
    expect(runs.build).toBe(1);
  });

  it("A12 a run held by this daemon is still refused as already building", async () => {
    await startBuild(PROJECT, PLAN);
    await expect(startBuild(PROJECT, PLAN)).rejects.toThrow(/already building/);
    expect(runs.build).toBe(1);
  });

  it("A12 a run whose step session lives is refused after the admin forgot it", async () => {
    await startBuild(PROJECT, PLAN);
    void handed.build?.run("work", "Build Phase 2: second");
    await vi.waitFor(() =>
      expect(readRecord("build")).toMatchObject({
        process: { pid: process.pid },
      }),
    );
    forget();
    await expect(startBuild(PROJECT, PLAN)).rejects.toThrow(/already building/);
  });
});

describe("A56 — a build still runs unasked to review; one that dies reads stopped with its reason", () => {
  it("A56 an approved plan's build runs to its stop at review", async () => {
    await startBuild(PROJECT, PLAN);
    expect(buildState(PROJECT, PLAN)?.running).toBe(true);
    finishBuild({ step: "review" });
    await vi.waitFor(() =>
      expect(buildState(PROJECT, PLAN)?.stop?.step).toBe("review"),
    );
  });

  it("A56 a build killed in the middle reads stopped with its reason, not as nothing", () => {
    writeRunRecord(home, deadRecord("build"));
    forget();
    expect(buildState(PROJECT, PLAN)).toMatchObject({
      running: false,
      stop: { step: "cannot-continue", why: expect.stringContaining("gone") },
    });
  });
});

describe("A58 — an accepted brief still starts its planning run, and the run has a record", () => {
  it("A58 the run begun at acceptance is on disk like any other", async () => {
    held.implStatus = null;
    await planningConversationEnded(PROJECT, PLAN, "2026-10-19T11:00:00.000Z");
    expect(runs.planning).toBe(1);
    expect(readRecord("planning")).toMatchObject({
      plan: PLAN,
      kind: "planning",
      stop: null,
    });
  });
});

describe("A74 — Build on a dead planning run starts planning again, never the build", () => {
  it("A74 a planning run that died is started again at its next planning step", async () => {
    held.implStatus = "draft";
    writeRunRecord(
      home,
      deadRecord("planning", { step: "plan-adr", phase: null }),
    );
    await startBuild(PROJECT, PLAN);
    expect(runs.planning).toBe(1);
    expect(runs.build).toBe(0);
  });

  it("A74 a plan whose impl is a draft is sent to planning, not built", async () => {
    held.implStatus = "draft";
    writeRunRecord(home, deadRecord("build"));
    await startBuild(PROJECT, PLAN);
    expect(runs.planning).toBe(1);
    expect(runs.build).toBe(0);
  });
});

describe("A57 — a dead run of a plan not yet accepted never starts the release", () => {
  it("A57 Build on a dead release of an unaccepted plan starts the build step", async () => {
    writeRunRecord(
      home,
      deadRecord("release", { step: "retrospective", phase: null }),
    );
    await startBuild(PROJECT, PLAN);
    expect(runs.release).toBe(0);
    expect(runs.build).toBe(1);
  });
});

describe("A96 — a just-pressed build is running from the moment it is pressed", () => {
  it("A96 while it is still finding its worktree it reads running, and a second press is refused", async () => {
    let found: () => void = () => {};
    whereHold = new Promise((resolve) => {
      found = resolve;
    });
    const first = startBuild(PROJECT, PLAN);
    // Before the first step session spawns: no process recorded yet.
    await vi.waitFor(() => expect(readRecord("build")).not.toBeNull());
    expect(buildState(PROJECT, PLAN)?.running).toBe(true);
    expect(buildState(PROJECT, PLAN)?.stop ?? null).toBeNull();
    await expect(startBuild(PROJECT, PLAN)).rejects.toThrow(/already building/);
    found();
    await first;
    expect(runs.build).toBe(1);
  });

  it("A96 a build whose worktree cannot be found frees its hold and reads stopped with why", async () => {
    let fail: (e: Error) => void = () => {};
    whereHold = new Promise((_resolve, reject) => {
      fail = reject;
    });
    const first = startBuild(PROJECT, PLAN);
    await vi.waitFor(() => expect(readRecord("build")).not.toBeNull());
    fail(new Error("no worktree for keeps-a-record"));
    await expect(first).rejects.toThrow(/no worktree/);
    expect(buildState(PROJECT, PLAN)?.running).toBe(false);
    whereHold = Promise.resolve();
    await expect(startBuild(PROJECT, PLAN)).resolves.toMatchObject({
      running: true,
    });
  });
});
