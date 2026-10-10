import { fixPrompt } from "@infinitedusky/indusk-mcp/promises/fix";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROJECT,
  PROJECT_PATH,
  PROOFS,
  promisesReaderMock,
  proofMock,
} from "./helpers/cockpit-fixture";

// promise: a-break-opens-a-fix-in-one-click

/**
 * plan-cockpit A31, the route half: *Start a fix plan* starts the developer's
 * own `claude` in the project, its first message the package's `fixPrompt` for
 * the break — the promise, its symptom, its trace link and its tests. The
 * session host, the registry and the proof are stood in for; the prompt is
 * the package's own function, so a route that worded it itself would differ.
 */

const started: Array<Record<string, unknown>> = [];
let busy: string | null = null;

vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  refuse: (status: number, message: string) =>
    Response.json({ error: message }, { status }),
  planLocation: async (_project: string, plan: string) => ({
    root: "/mock/cockpit-proj",
    cwd: plan === "alpha-one" ? "/mock/cockpit-proj" : "/mock/elsewhere",
  }),
  sessionManager: () => ({
    start: (opts: Record<string, unknown>) => {
      if (busy) throw new Error(busy);
      started.push(opts);
      return { id: "s-1", session: { pid: 4242 } };
    },
  }),
}));
vi.mock("@/lib/registry-client", () => ({
  getProjectPath: (name: string) => (name === PROJECT ? PROJECT_PATH : null),
}));
vi.mock("@/lib/promises-reader", () => promisesReaderMock());
vi.mock("@infinitedusky/indusk-mcp/promises/proof", () => proofMock());

import { POST } from "@/app/api/promises/[name]/fix/route";

const post = (name: string, body: unknown) =>
  POST(
    new NextRequest(`http://127.0.0.1:3996/api/promises/${name}/fix`, {
      method: "POST",
      headers: {
        host: "127.0.0.1:3996",
        origin: "http://127.0.0.1:3996",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ name }) },
  );

beforeEach(() => {
  started.length = 0;
  busy = null;
});

describe("A31 — Start a fix plan starts the developer's claude with the break", () => {
  it("A31 starts a session in the project whose prompt is the package's fix prompt for this break", async () => {
    const res = await post("seat-holds-never-double-book", {
      project: PROJECT,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "s-1" });
    expect(started).toHaveLength(1);
    const prompt = String(started[0].prompt);
    const broken = PROOFS["seat-holds-never-double-book"].broken;
    expect(broken).not.toBeNull();
    expect(prompt).toBe(fixPrompt(broken as NonNullable<typeof broken>));
    expect(prompt).toContain("seat-holds-never-double-book");
    expect(prompt).toContain("seat 4 held twice");
    expect(prompt).toContain("https://jaeger.example/trace/abc123");
    expect(prompt).toContain("src/seat-holds-never-double-book.test.ts");
    expect(started[0]).toMatchObject({
      project: PROJECT,
      plan: "alpha-one",
      kind: "planning",
      cwd: "/mock/cockpit-proj",
    });
  });

  it("A31 refuses a promise that is not broken, and starts nothing", async () => {
    const res = await post("receipts-arrive-within-a-minute", {
      project: PROJECT,
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain(
      "not broken",
    );
    expect(started).toHaveLength(0);
  });

  it("A31 says so for a promise the registry does not hold, and for a missing project", async () => {
    expect((await post("no-such-promise", { project: PROJECT })).status).toBe(
      404,
    );
    expect((await post("seat-holds-never-double-book", {})).status).toBe(400);
    expect(
      (await post("seat-holds-never-double-book", { project: "nope" })).status,
    ).toBe(404);
    expect(started).toHaveLength(0);
  });

  it("A31 gives the reason when a session is already running", async () => {
    busy =
      "a session is already running: s-0, build for mid-build — stop it first";
    const res = await post("seat-holds-never-double-book", {
      project: PROJECT,
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain(
      "already running",
    );
  });
});
