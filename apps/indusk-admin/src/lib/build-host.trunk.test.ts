// promise: a-brief-is-accepted-on-current-main
// clause: a-brief-is-accepted-on-current-main/main-is-merged-first
// clause: a-brief-is-accepted-on-current-main/a-conflict-refuses
// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report
// promise: an-accepted-brief-is-planned-unasked

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefText } from "../../../indusk-mcp/src/__tests__/helpers/plan-fixture";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1: the admin's planning start
 * brings main into the plan's branch before its first step, so a brief
 * accepted by hand, or a run held for looks, is still planned on current main;
 * a conflict stops the run and the route answers with the refusal. Real git in
 * a temporary repository; the package's plan functions are the real ones, and
 * the runner and the session host are stood in for.
 */

const PROJECT = "seats";
const PLAN = "seat-holds";
const briefPath = ".indusk/planning/seat-holds/brief.md";

/**
 * A trunk on `main` with InDusk configured and one plan worktree, as the
 * package's own `planLifecycleProject` builds them — inlined, because the
 * admin's type-check cannot take that fixture's imports.
 */
function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@test.local",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@test.local",
    },
  });
  if (r.status !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

interface PlanLifecycleProject {
  base: string;
  trunk: string;
  makeWorktree(plan: string): string;
  commit(
    checkout: string,
    files: Record<string, string>,
    message: string,
  ): void;
  cleanup(): void;
}

function planLifecycleProject(prefix: string): PlanLifecycleProject {
  const base = realpathSync(mkdtempSync(join(tmpdir(), `${prefix}-`)));
  const trunk = join(base, "proj");
  mkdirSync(join(trunk, ".indusk", "promises"), { recursive: true });
  mkdirSync(join(trunk, ".indusk", "planning"), { recursive: true });
  git(trunk, ["init", "-q", "-b", "main"]);
  writeFileSync(
    join(trunk, ".indusk", "config.json"),
    `${JSON.stringify({ mode: "full", otel: { role: "library" }, promises: { domains: ["seating"] } })}\n`,
  );
  writeFileSync(join(trunk, ".indusk", "planning", "master.md"), "# Plans\n");
  writeFileSync(join(trunk, "README.md"), "proj\n");
  git(trunk, ["add", "-A"]);
  git(trunk, ["commit", "-q", "-m", "init"]);
  return {
    base,
    trunk,
    makeWorktree(plan) {
      const path = join(base, "proj-worktrees", plan);
      git(trunk, ["worktree", "add", "-q", path, "-b", `plan/${plan}`, "main"]);
      const common = git(trunk, [
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ]);
      writeFileSync(
        join(common, "indusk-plan-worktrees.json"),
        `${JSON.stringify({
          version: 1,
          assignments: [
            {
              plan,
              path: realpathSync(path),
              branch: `plan/${plan}`,
              at: new Date().toISOString(),
            },
          ],
        })}\n`,
      );
      return realpathSync(path);
    },
    commit(checkout, files, message) {
      for (const [rel, content] of Object.entries(files)) {
        mkdirSync(dirname(join(checkout, rel)), { recursive: true });
        writeFileSync(join(checkout, rel), content);
      }
      git(checkout, ["add", "-A"]);
      git(checkout, ["commit", "-q", "-m", message]);
    },
    cleanup() {
      rmSync(base, { recursive: true, force: true });
    },
  };
}

let trunk = "";
let wt = "";
const runs: Array<{ sawMainFile: boolean }> = [];
const place = vi.hoisted(() => ({ full: false }));

vi.mock("@infinitedusky/indusk-mcp/build", async () => {
  const actual = await vi.importActual<
    typeof import("@infinitedusky/indusk-mcp/build")
  >("@infinitedusky/indusk-mcp/build");
  const WRITTEN = { exists: false, ok: false };
  return {
    ...actual,
    autoAccepts: () => false,
    buildStepModel: async () => null,
    readBuildPlan: async () => ({}),
    runStepSession: async () => ({ error: null }),
    runBuild: async () => ({ step: "review", why: "waits for the person" }),
    runRelease: async () => ({ released: true, error: null }),
    readPlanningState: async () => ({
      required: ["brief", "test-plan", "adr", "impl"],
      documents: { "test-plan": WRITTEN, adr: WRITTEN, impl: WRITTEN },
      implStatus: null,
      contractOk: true,
      blocker: null,
      briefStatus: "accepted",
      acceptedAt: "2026-10-19T12:00:00.000Z",
      unapprovedLooks: [],
    }),
    runPlanning: async () => {
      runs.push({
        sawMainFile: existsSync(join(wt, "docs", "from-main.md")),
      });
      return { step: "ready-for-approval" };
    },
  };
});
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: trunk, cwd: wt }),
  adminOnly: () => null,
  refuse: (status: number, error: string) =>
    Response.json({ error }, { status }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => {
      if (place.full) throw new Error("every place is taken");
      return () => {};
    },
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => trunk }));

import { POST } from "../app/api/plans/plan/route";
import { planningConversationEnded, startPlanning } from "./build-host";

let p: PlanLifecycleProject;
beforeEach(() => {
  runs.length = 0;
  place.full = false;
  p = planLifecycleProject("build-host-trunk");
  trunk = p.trunk;
  wt = p.makeWorktree(PLAN);
  p.commit(
    wt,
    {
      [briefPath]: briefText(PLAN).replace("status: accepted", "status: draft"),
    },
    "the brief",
  );
  // Accepted by hand, as an agent that only follows the skill's advice might.
  p.commit(wt, { [briefPath]: briefText(PLAN) }, "brief accepted by hand");
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.builds")]?.clear();
  g[Symbol.for("indusk.admin.plannings")]?.clear();
});
afterEach(() => {
  p.cleanup();
});

/** The branch and main change the same line of one file. */
function conflict(): void {
  p.commit(trunk, { "docs/notes.md": "a\nb\nc\n" }, "notes");
  git(wt, ["merge", "-q", "main"]);
  p.commit(wt, { "docs/notes.md": "a\nmine\nc\n" }, "mine");
  p.commit(trunk, { "docs/notes.md": "a\ntheirs\nc\n" }, "theirs");
}

/** A tracer that keeps each span's attributes, as the package's capture tracer does. */
function captured(): {
  tracer: { startSpan: () => unknown };
  spans: Array<Record<string, unknown>>;
} {
  const spans: Array<Record<string, unknown>> = [];
  return {
    spans,
    tracer: {
      startSpan: () => {
        const attrs: Record<string, unknown> = {};
        spans.push(attrs);
        return {
          setAttribute: (k: string, v: unknown) => {
            attrs[k] = v;
          },
          addEvent: () => {},
          end: () => {},
        };
      },
    },
  };
}
const outcomeOf = (spans: Array<Record<string, unknown>>, clause: string) =>
  spans.find((s) => s["indusk.clause"] === clause)?.["indusk.promise.outcome"];

describe("the planning start reports the clauses of a brief accepted on current main", () => {
  // a-run-can-be-trusted A47, second half: the admin's planning start reports through the
  // same function the command line does, so each lane's span is read here.
  it("a branch behind main reports main-is-merged-first and the-person-never-merges upheld", async () => {
    p.commit(trunk, { "docs/from-main.md": "main\n" }, "main moves");
    const { tracer, spans } = captured();
    await startPlanning(PROJECT, PLAN, {
      tracer: tracer as unknown as NonNullable<
        Parameters<typeof startPlanning>[2]
      >["tracer"],
    });
    expect(outcomeOf(spans, "main-is-merged-first")).toBe("upheld");
    expect(outcomeOf(spans, "the-person-never-merges")).toBe("upheld");
    expect(
      spans.every(
        (s) => s["indusk.promise"] === "a-brief-is-accepted-on-current-main",
      ),
    ).toBe(true);
  });

  it("a conflicting planning start reports a-conflict-refuses upheld, the branch as it was", async () => {
    conflict();
    const { tracer, spans } = captured();
    await expect(
      startPlanning(PROJECT, PLAN, {
        tracer: tracer as unknown as NonNullable<
          Parameters<typeof startPlanning>[2]
        >["tracer"],
      }),
    ).rejects.toThrow(/docs\/notes\.md/);
    expect(outcomeOf(spans, "a-conflict-refuses")).toBe("upheld");
    expect(outcomeOf(spans, "main-is-merged-first")).toBeUndefined();
  });
});

describe("the planning start brings main in", () => {
  it("A7: a brief accepted by hand on a branch behind main is planned in a worktree holding main's newest commit", async () => {
    p.commit(trunk, { "docs/from-main.md": "main\n" }, "main moves");
    const state = await startPlanning(PROJECT, PLAN);
    expect(state.started).toBe(true);
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0].sawMainFile).toBe(true);
  });

  it("A8: a conflicting merge stops the run before any step, naming the file, the branch as it was", async () => {
    conflict();
    const head = git(wt, ["rev-parse", "HEAD"]);
    await expect(startPlanning(PROJECT, PLAN)).rejects.toThrow(
      /docs\/notes\.md/,
    );
    expect(runs).toHaveLength(0);
    expect(git(wt, ["rev-parse", "HEAD"])).toBe(head);
    expect(git(wt, ["status", "--porcelain"])).toBe("");
  });

  it("A14: the planning route answers a conflicting plan with 409 and the refusal as `error`", async () => {
    conflict();
    const res = await POST(
      new NextRequest("http://localhost/api/plans/plan", {
        method: "POST",
        body: JSON.stringify({ project: PROJECT, plan: PLAN }),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("docs/notes.md");
    expect(body.error).toContain("nothing was changed");
  });
});

describe("the end of the accepting conversation starts the run once", () => {
  it("A21: a conversation that accepted the brief starts one run, in a worktree holding main's new file", async () => {
    p.commit(trunk, { "docs/from-main.md": "main\n" }, "main moves");
    const state = await planningConversationEnded(
      PROJECT,
      PLAN,
      "2026-10-19T11:00:00.000Z",
    );
    expect(state?.started).toBe(true);
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0].sawMainFile).toBe(true);
  });

  it("A22: a conflicting plan's conversation end starts no run", async () => {
    conflict();
    const state = await planningConversationEnded(
      PROJECT,
      PLAN,
      "2026-10-19T11:00:00.000Z",
    );
    expect(state).toBeNull();
    expect(runs).toHaveLength(0);
  });
});

describe("a planning start that cannot go on leaves the branch as it was", () => {
  it("A34: no place for the run on a branch behind main leaves the head where it was", async () => {
    p.commit(trunk, { "docs/from-main.md": "main\n" }, "main moves");
    p.commit(wt, { "docs/mine.md": "mine\n" }, "my work");
    const head = git(wt, ["rev-parse", "HEAD"]);
    place.full = true;
    await expect(startPlanning(PROJECT, PLAN)).rejects.toThrow(/taken/);
    expect(git(wt, ["rev-parse", "HEAD"])).toBe(head);
    expect(existsSync(join(wt, "docs", "from-main.md"))).toBe(false);
    expect(runs).toHaveLength(0);
  });
});

describe("a plan with no branch of its own", () => {
  it("A30: a plan planned on the trunk still starts its planning run", async () => {
    const lone = planLifecycleProject("build-host-lone");
    try {
      lone.commit(lone.trunk, { [briefPath]: briefText(PLAN) }, "the brief");
      trunk = lone.trunk;
      wt = lone.trunk;
      const state = await startPlanning(PROJECT, PLAN);
      expect(state.started).toBe(true);
      await vi.waitFor(() => expect(runs).toHaveLength(1));
    } finally {
      lone.cleanup();
    }
  });
});
