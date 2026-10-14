import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// promise: a-session-can-be-stopped

/**
 * new-project-flow A30: creating a project ends its conversation's agent. The
 * agent otherwise keeps running in a deleted draft folder and holds the one
 * session slot, so no new conversation can start. The session host is stood in
 * for (as `new-project-routes.test.ts` does); the draft is the package's own.
 */

const stopped: string[] = [];
let running: { id: string; plan: string } | undefined;

vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  refuse: (status: number, message: string) =>
    Response.json({ error: message }, { status }),
  sessionManager: () => ({
    current: () => running,
    get: (id: string) => ({
      stop: async () => {
        stopped.push(id);
        running = undefined;
      },
    }),
    subscribe: () => () => {},
    start: () => ({ id: "s-1", session: { pid: 1 } }),
  }),
}));

let home: string;
const previousHome = process.env.INDUSK_HOME;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "new-project-accept-"));
  process.env.INDUSK_HOME = home;
  stopped.length = 0;
});

afterEach(() => {
  if (previousHome === undefined) delete process.env.INDUSK_HOME;
  else process.env.INDUSK_HOME = previousHome;
  rmSync(home, { recursive: true, force: true });
});

const request = () =>
  new NextRequest("http://127.0.0.1:3996/api/new-projects/x/accept", {
    method: "POST",
    headers: { host: "127.0.0.1:3996", origin: "http://127.0.0.1:3996" },
  });

describe("A30 — creating a project ends its conversation's agent", () => {
  it("A30 stops the draft's running session before creation, leaving the slot free", async () => {
    const { createProjectDraft } = await import("@infinitedusky/indusk-mcp/new-project");
    const draft = createProjectDraft(home, { message: "A parental control system" });
    running = { id: "s-9", plan: `new-project:${draft.id}` };

    const { POST } = await import("@/app/api/new-projects/[id]/accept/route");
    const res = await POST(request(), { params: Promise.resolve({ id: draft.id }) });
    await res.text();

    expect(stopped).toEqual(["s-9"]);
    expect(running).toBeUndefined();
  });
});
