// promise: approval-waits-for-a-finished-plan
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * approval-waits-for-the-planning-run A13: the admin's waiting reader, joined
 * to the real planning state of a run the admin started through its host. The
 * host's own state is read, never mocked; only what the host stands on is
 * stood in for (the package's runner, the session host, the registry).
 */

let project: string;
let handed: { onStep: (step: string) => void } | null = null;
let failRun: (why: string) => void = () => {};
let finishRun: () => void = () => {};

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
    readPlanningState: async () => ({
      required: ["brief", "test-plan", "adr", "impl"],
      documents: {
        "test-plan": { exists: false, ok: false },
        adr: { exists: false, ok: false },
        impl: { exists: false, ok: false },
      },
      implStatus: null,
      contractOk: true,
      blocker: null,
      briefStatus: "accepted",
      acceptedAt: "2026-10-19T12:00:00.000Z",
      unapprovedLooks: [],
    }),
    runPlanning: (deps: { onStep: (step: string) => void }) => {
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
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => () => {},
    running: () => [],
    pendingQuestion: () => null,
    isWriting: () => false,
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => project }));

import { startPlanning } from "./build-host";
import { readWaiting } from "./decisions-reader";
import { readActivePlans } from "./planning-reader";

const PROJECT = "proj";
const PLAN = "p";

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "reader-planning-"));
  const dir = join(project, ".indusk/planning", PLAN);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(project, ".indusk/config.json"), '{ "mode": "full" }\n');
  const doc = (status: string) =>
    `---\ntitle: "P"\nstatus: ${status}\nworkflow: bugfix\n---\n\n# P\n`;
  writeFileSync(join(dir, "brief.md"), doc("accepted"));
  writeFileSync(join(dir, "test-plan.md"), doc("accepted"));
  writeFileSync(join(dir, "impl.md"), doc("draft"));
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.plannings")]?.clear();
});
afterEach(() => {
  finishRun();
  rmSync(project, { recursive: true, force: true });
});

describe("A13 — the waiting reader follows the admin's real planning run", () => {
  it("A13 lists nothing while the run is between steps, and the plan as needing its plan review, with the reason, once the run stops on a failure", async () => {
    await startPlanning(PROJECT, PLAN);
    handed?.onStep("plan-impl");

    const plans = await readActivePlans(project);
    expect(await readWaiting(PROJECT, project, plans)).toEqual([]);

    failRun("the last step's session failed: exit 1");
    const { planningState } = await import("./build-host");
    await vi.waitFor(() =>
      expect(planningState(PROJECT, PLAN)?.running).toBe(false),
    );

    const waiting = await readWaiting(PROJECT, project, plans);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.on).toBe("plan-review");
    expect(waiting[0]?.decision).toContain(
      "the last step's session failed: exit 1",
    );
  });
});
