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

/**
 * The trunk the release's landing is read from (A21), stood in for by a program runner that
 * answers `git` from this flag: the real asynchronous readers and the real kept reading run,
 * no program starts. `landed` is whether the trunk's log holds the plan's landing merge.
 */
const trunk = vi.hoisted(() => ({ landed: false, plan: "release-twice" }));

let releases = 0;
let finishRelease: () => void = () => {};

vi.mock("@infinitedusky/indusk-mcp/build", () => ({
  autoAccepts: () => false,
  buildStepModel: async () => null,
  timedStep: <T>(run: T) => run,
  planningStepRefusal: () => null,
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
vi.mock("@infinitedusky/indusk-mcp/run-record", async () => {
  const actual = await vi.importActual<
    typeof import("@infinitedusky/indusk-mcp/run-record")
  >("@infinitedusky/indusk-mcp/run-record");
  const exec: import("@infinitedusky/indusk-mcp/run-record").Exec = async (
    _file,
    args,
  ) => {
    if (args[0] === "log")
      return trunk.landed
        ? `Merge plan/${trunk.plan}: ${trunk.plan} landed\n`
        : "";
    if (args[0] === "branch") return "main\n";
    if (args[0] === "for-each-ref") return "main\n";
    return "";
  };
  return {
    ...actual,
    readLandings: (root: string, deps = {}) =>
      actual.readLandings(root, { ...deps, exec }),
  };
});
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => () => {},
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => "/p" }));

import {
  keptRead,
  peekKept,
  readLandings,
  resetKept,
} from "@infinitedusky/indusk-mcp/run-record";
import { buildState, startBuild, startRelease } from "./build-host";

const PROJECT = "seats";
const PLAN = "release-twice";

beforeEach(async () => {
  resetKept();
  trunk.landed = false;
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

describe("A21 — a release that ends just after the landing was read reads landed", () => {
  it("A21 a landing reading kept before the merge does not make a landed release read as not on main", async () => {
    // A page read the trunk's landings a moment ago: the plan had not landed, and that is kept.
    expect((await readLandings("/p"))(PLAN)).toBe(false);
    await startRelease(PROJECT, PLAN);
    // `plans land` merges the plan; the release step then ends.
    trunk.landed = true;
    finishRelease();
    await vi.waitFor(() =>
      expect(buildState(PROJECT, PLAN)?.release).toEqual({
        released: true,
        error: null,
      }),
    );
  });
});

describe("A20 — pressing Build drops the kept process table", () => {
  it("A20 a table kept before the press is gone after it, so a run just started is never read from an older table", async () => {
    await keptRead("ps", async () => []);
    expect(peekKept("ps"), "kept before the press").toBeDefined();
    await startBuild(PROJECT, PLAN);
    expect(peekKept("ps"), "kept after the press").toBeUndefined();
  });
});
