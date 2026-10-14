import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Coming back to a planning session: a start for the project, plan and kind
 * that already has one running answers with that session's id (the page then
 * attaches) instead of "a session is already running". A start for another
 * plan is still refused.
 */
const manager = vi.hoisted(() => ({
  current: vi.fn(),
  start: vi.fn(),
}));

vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  planLocation: async () => ({ cwd: "/w" }),
  refuse: (status: number, error: string) =>
    Response.json({ error }, { status }),
  sessionManager: () => manager,
}));

import type { NextRequest } from "next/server";
import { POST } from "./route";

const running = {
  id: "s1",
  project: "dusk",
  plan: "embedded-browser",
  kind: "planning",
};
const post = (plan: string, kind = "planning") =>
  POST({
    json: async () => ({ project: "dusk", plan, kind, prompt: "hi" }),
  } as unknown as NextRequest);

beforeEach(() => {
  manager.current.mockReset();
  manager.start.mockReset();
  manager.start.mockImplementation(() => {
    throw new Error("a session is already running: s1");
  });
});

describe("POST /api/sessions while a session is running", () => {
  it("answers with the running session's id for the same project, plan and kind", async () => {
    manager.current.mockReturnValue(running);
    const r = await post("embedded-browser");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: "s1", attached: true });
    expect(manager.start).not.toHaveBeenCalled();
  });

  it("still refuses a session for another plan, naming the running one", async () => {
    manager.current.mockReturnValue(running);
    const r = await post("another-plan");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("already running");
  });

  it("still refuses another kind for the same plan", async () => {
    manager.current.mockReturnValue(running);
    expect((await post("embedded-browser", "build")).status).toBe(409);
  });
});
