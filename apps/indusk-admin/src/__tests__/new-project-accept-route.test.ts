import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// promise: a-new-project-is-made-by-the-agent

/**
 * new-project-flow A5, the route half: accepting a proposal answers as the
 * package makes the project - a line for each step it reports, then the way
 * into the project, or why it stopped. The package's `createProject` is stood
 * in for (its own behaviour is A4-A22 in the package's tests); the draft is
 * the package's, in a temporary `INDUSK_HOME`.
 */

const made = vi.hoisted(() => ({
  run: async (
    _report: (step: string, state: string) => void,
  ): Promise<{ name: string; root: string; remoteError?: string }> => ({
    name: "",
    root: "",
  }),
}));

vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  refuse: (status: number, message: string) =>
    Response.json({ error: message }, { status }),
  sessionManager: () => ({
    forPlan: () => undefined,
    capRefusal: () => undefined,
  }),
}));

vi.mock("@infinitedusky/indusk-mcp/new-project", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@infinitedusky/indusk-mcp/new-project")
  >()),
  createProject: (
    _home: string,
    _id: string,
    options: { report: (step: string, state: string) => void },
  ) => made.run(options.report),
}));

let home: string;
const previousHome = process.env.INDUSK_HOME;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "new-project-accept-"));
  process.env.INDUSK_HOME = home;
  mkdirSync(join(home, "new-projects", "d1"), { recursive: true });
  writeFileSync(join(home, "new-projects", "d1", "draft.json"), "{}\n");
});

afterEach(() => {
  if (previousHome === undefined) {
    delete process.env.INDUSK_HOME;
  } else {
    process.env.INDUSK_HOME = previousHome;
  }
  rmSync(home, { recursive: true, force: true });
});

const accept = async (id: string) => {
  const { POST } = await import("@/app/api/new-projects/[id]/accept/route");
  return POST(
    new NextRequest(`http://127.0.0.1:3996/api/new-projects/${id}/accept`, {
      method: "POST",
      headers: {
        host: "127.0.0.1:3996",
        origin: "http://127.0.0.1:3996",
        "content-type": "application/json",
      },
      // Create sends the proposal as the person saved it (A38).
      body: JSON.stringify({
        proposal: {
          name: "homework-gate",
          location: "/p/homework-gate-workbench",
          repos: [{ name: "homework-gate" }],
          milestones: [],
          recommendations: [],
          documentsOff: [],
          remote: { github: false },
        },
      }),
    }),
    { params: Promise.resolve({ id }) },
  );
};

const lines = async (res: Response) =>
  (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

describe("A5 — accepting answers step by step and ends with the way in", () => {
  it("A5 streams each step the package reports, then the project's page", async () => {
    made.run = async (report) => {
      report("workbench", "working");
      report("workbench", "done");
      report("repository", "working");
      return { name: "homework-gate-workbench", root: "/p/x" };
    };
    const res = await accept("d1");
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await lines(res)).toEqual([
      { type: "step", id: "workbench", state: "working" },
      { type: "step", id: "workbench", state: "done" },
      { type: "step", id: "repository", state: "working" },
      {
        type: "done",
        name: "homework-gate-workbench",
        href: "/p/homework-gate-workbench/",
      },
    ]);
  });

  it("A5 says why when the package refuses, instead of ending silently", async () => {
    made.run = async () => {
      throw new Error("No parent directory is set.");
    };
    expect(await lines(await accept("d1"))).toEqual([
      { type: "error", message: "No parent directory is set." },
    ]);
  });

  it("A5 refuses a conversation that is not there, making nothing", async () => {
    let ran = false;
    made.run = async () => {
      ran = true;
      return { name: "x", root: "/x" };
    };
    const res = await accept("nope");
    expect(res.status).toBe(404);
    expect(ran).toBe(false);
  });
});
