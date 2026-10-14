// promise: decisions-wait-in-one-place

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * plan-cockpit A37: a review accepted once is not offered again. The card is
 * shown for as long as the plan waits on review, and the build's recorded stop
 * is part of what says so — so starting the release must end that wait, and a
 * second accept while the release runs must be refused, not start a second
 * release. The package's runner and the session host are stood in for; the
 * build host's own bookkeeping is what is under test.
 */

let releases = 0;
let finishRelease: () => void = () => {};

vi.mock("@infinitedusky/indusk-mcp/build", () => ({
  autoAccepts: () => false,
  buildStepModel: async () => null,
  readBuildPlan: async () => ({}),
  runStepSession: async () => ({}),
  runBuild: async () => ({ step: "review", why: "waits for the person" }),
  runRelease: () => {
    releases += 1;
    return new Promise((resolve) => {
      finishRelease = () => resolve({ released: true, error: null });
    });
  },
}));
vi.mock("@infinitedusky/indusk-mcp/plans", () => ({
  acceptPlan: async () => {},
}));
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({ forPlan: () => undefined }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => "/p" }));

import { buildState, startBuild, startRelease } from "./build-host";

const PROJECT = "seats";
const PLAN = "release-twice";

beforeEach(async () => {
  releases = 0;
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.builds")]?.clear();
  await startBuild(PROJECT, PLAN);
  await vi.waitFor(() =>
    expect(buildState(PROJECT, PLAN)?.running).toBe(false),
  );
});

describe("A37 — a review is accepted once", () => {
  it("A37 the build had stopped at review, so the plan waits on it", () => {
    expect(buildState(PROJECT, PLAN)?.stop?.step).toBe("review");
  });

  it("A37 starting the release ends the wait on review", async () => {
    await startRelease(PROJECT, PLAN);
    expect(buildState(PROJECT, PLAN)?.stop?.step).not.toBe("review");
    finishRelease();
  });

  it("A37 a second accept while the release runs is refused, and starts no second release", async () => {
    await startRelease(PROJECT, PLAN);
    await expect(startRelease(PROJECT, PLAN)).rejects.toThrow(/already/);
    expect(releases).toBe(1);
    finishRelease();
  });
});
