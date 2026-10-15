import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Coming back to a planning session: a start for the project, plan and kind
 * that already has one running, and that no page is showing, answers with that
 * session's id (the page then attaches). When a page is showing it already,
 * the start is refused with the question whether to continue it here, and the
 * running session's id (sessions-per-plan; Sandy, 2026-10-14). Another plan's
 * start is not in its way.
 */
const manager = vi.hoisted(() => ({
  forPlan: vi.fn(),
  isWatched: vi.fn(),
  start: vi.fn(),
}));

vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  planLocation: async () => ({ cwd: "/w" }),
  refuse: (status: number, error: string) =>
    Response.json({ error }, { status }),
  refuseRunning: (error: string, running: { id: string }) =>
    Response.json({ error, running: { id: running.id } }, { status: 409 }),
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
  manager.forPlan.mockReset();
  manager.isWatched.mockReset();
  manager.start.mockReset();
  manager.start.mockReturnValue({ id: "s2", session: { pid: 1 } });
});

describe("POST /api/sessions while a session is running", () => {
  it("answers with the running session's id when no page is showing it", async () => {
    manager.forPlan.mockReturnValue(running);
    manager.isWatched.mockReturnValue(false);
    const r = await post("embedded-browser");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: "s1", attached: true });
    expect(manager.start).not.toHaveBeenCalled();
  });

  it("asks whether to continue it here when a page is already showing it", async () => {
    manager.forPlan.mockReturnValue(running);
    manager.isWatched.mockReturnValue(true);
    manager.start.mockImplementation(() => {
      throw Object.assign(
        new Error(
          "A planning session is already running on this plan (embedded-browser). Do you want to continue that session here?",
        ),
        { running },
      );
    });
    const r = await post("embedded-browser");
    expect(r.status).toBe(409);
    const body = await r.json();
    expect(body.error).toContain("Do you want to continue that session here?");
    expect(body.running).toEqual({ id: "s1" });
  });

  it("starts another plan's session", async () => {
    manager.forPlan.mockReturnValue(undefined);
    const r = await post("another-plan");
    expect(r.status).toBe(201);
    expect(manager.start).toHaveBeenCalled();
  });
});
