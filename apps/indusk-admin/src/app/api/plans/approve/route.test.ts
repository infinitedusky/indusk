// promise: an-accepted-brief-is-planned-unasked

import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * a-brief-is-planned-unasked T8 (A8): approving a plan from the admin starts
 * its build, and an approval refused for any reason starts nothing. The
 * package's `approvePlan` and the build host are stood in for; the route's own
 * order is what is under test: approve first, build only after it returned.
 */

const calls: string[] = [];
let approval: () => Promise<unknown>;
let build: () => Promise<unknown>;

vi.mock("@infinitedusky/indusk-mcp/plans", () => {
  class PlanCommandRefusal extends Error {}
  return {
    PlanCommandRefusal,
    approvePlan: async () => {
      calls.push("approve");
      return approval();
    },
  };
});
vi.mock("@/lib/build-host", () => ({
  startBuild: async () => {
    calls.push("build");
    return build();
  },
}));
vi.mock("@/lib/registry-client", () => ({ getProjectPath: () => "/p" }));
vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  refuse: (status: number, error: string) =>
    Response.json({ error }, { status }),
}));

import { PlanCommandRefusal } from "@infinitedusky/indusk-mcp/plans";
import { POST } from "./route";

const post = () =>
  POST(
    new Request("http://127.0.0.1:4000/api/plans/approve", {
      method: "POST",
      body: JSON.stringify({ project: "seats", plan: "a-plan" }),
    }) as NextRequest,
  );

beforeEach(() => {
  calls.length = 0;
  approval = async () => ({ plan: "a-plan", approved: "sha" });
  build = async () => ({ running: true });
});

describe("A8 — approving a plan starts its build", () => {
  it("A8 starts the build after the approval returned, in that order", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(calls).toEqual(["approve", "build"]);
    expect((await res.json()).build).toEqual({ started: true });
  });

  it("A8 starts nothing when the approval is refused", async () => {
    approval = async () => {
      throw new PlanCommandRefusal("a look is still proposed");
    };
    const res = await post();
    expect(res.status).toBe(409);
    expect(calls).toEqual(["approve"]);
  });

  it("A8 starts nothing when the approval fails for any other reason", async () => {
    approval = async () => {
      throw new Error("git failed");
    };
    await expect(post()).rejects.toThrow("git failed");
    expect(calls).toEqual(["approve"]);
  });

  it("A8 keeps the approval and says why when the build cannot start", async () => {
    build = async () => {
      throw new Error("another plan is building");
    };
    const res = await post();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe("sha");
    expect(body.build).toEqual({
      started: false,
      why: "another plan is building",
    });
  });
});
