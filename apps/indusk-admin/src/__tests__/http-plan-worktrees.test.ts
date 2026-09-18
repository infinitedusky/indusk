import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHome, startNextDev } from "./helpers/next-dev";

/**
 * admin-plan-worktrees — the admin reads a plan's live copy and names it.
 *
 * A1–A4, A15, and the admin halves of A7, A14, A16, over HTTP against
 * `next dev`. Each project is a real repository with real `git worktree
 * add`s: the bug is which checkout gets read, and one checkout cannot show
 * it. The assignment record is written by hand (the CLI that writes it is
 * the mcp package's A8–A13). Today the admin reads only the registered
 * trunk, so every row but A7 is red on its own assertion.
 *
 *   assigned   plan `demo` assigned to worktree `wt-alpha` (branch plan/demo)
 *   plain      an unassigned worktree `loose` with a checkoff (A7, A15)
 *   gone       assigned to a worktree that was then removed (A14)
 *   malformed  the record is not JSON (A16)
 */

const PLAN = "demo";
const RECORD_FILE = "indusk-plan-worktrees.json";

const IMPL = `---
title: demo
status: approved
---

# demo

## Checklist

### Phase 1: First

- [ ] first item
- [ ] second item

#### Phase 1 Verification

- [ ] first check

### Phase 2: Second

- [ ] third item
- [ ] fourth item

#### Phase 2 Verification

- [ ] second check
`;

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
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  }
  return r.stdout.trim();
}

interface Repo {
  base: string;
  trunk: string;
  addWorktree(dir: string, branch: string): string;
  checkOff(checkout: string, item: string): void;
  openPhase(checkout: string, phase: number): void;
  writeRecord(assignments: { path: string; branch: string }[]): void;
  writeRecordRaw(text: string): void;
  recordPath(): string;
}

function repo(label: string): Repo {
  const base = realpathSync(mkdtempSync(path.join(tmpdir(), `apw-${label}-`)));
  const trunk = path.join(base, "proj");
  const planDir = path.join(trunk, ".indusk", "planning", PLAN);
  mkdirSync(planDir, { recursive: true });
  git(trunk, ["init", "-q", "-b", "main"]);
  writeFileSync(
    path.join(trunk, ".indusk", "config.json"),
    `${JSON.stringify({ mode: "full" })}\n`,
  );
  writeFileSync(
    path.join(planDir, "brief.md"),
    "---\ntitle: demo\nstatus: accepted\n---\n\n# demo\n",
  );
  writeFileSync(path.join(planDir, "impl.md"), IMPL);
  git(trunk, ["add", "-A"]);
  git(trunk, ["commit", "-q", "-m", "plan demo"]);
  const implIn = (c: string) =>
    path.join(c, ".indusk", "planning", PLAN, "impl.md");
  const recordPath = () =>
    path.join(
      realpathSync(
        git(trunk, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
      ),
      RECORD_FILE,
    );
  return {
    base,
    trunk,
    addWorktree(dir, branch) {
      const p = path.join(base, dir);
      git(trunk, ["worktree", "add", "-q", p, "-b", branch, "main"]);
      return realpathSync(p);
    },
    checkOff(checkout, item) {
      const text = readFileSync(implIn(checkout), "utf-8");
      const next = text.replace(`- [ ] ${item}`, `- [x] ${item}`);
      if (next === text) throw new Error(`no unchecked "${item}"`);
      writeFileSync(implIn(checkout), next);
    },
    openPhase(checkout, phase) {
      const sha = git(checkout, ["rev-parse", "HEAD"]);
      writeFileSync(
        path.join(checkout, ".indusk", "phase-boundary.jsonl"),
        `${JSON.stringify({ plan: PLAN, phase, kind: "build", sha, at: new Date().toISOString() })}\n`,
      );
    },
    writeRecord(assignments) {
      const at = new Date().toISOString();
      writeFileSync(
        recordPath(),
        `${JSON.stringify({ version: 1, assignments: assignments.map((a) => ({ plan: PLAN, ...a, at })) }, null, 2)}\n`,
      );
    },
    writeRecordRaw(text) {
      writeFileSync(recordPath(), text);
    },
    recordPath,
  };
}

/**
 * The active phase's stage bar, as the page renders it before any section is
 * opened: which phase it is, and its implementation segment's "n of m".
 */
function activeBar(html: string): { phase: string; items: string } | null {
  const at = html.indexOf('data-testid="phase-bar-active"');
  if (at < 0) return null;
  const chunk = html.slice(at, at + 4000);
  const phase = chunk.match(/data-phase="([^"]+)"/)?.[1];
  const items = chunk.match(/title="implementation: (\d+ of \d+)"/)?.[1];
  return phase && items ? { phase, items } : null;
}

let stop: (() => Promise<void>) | null = null;
let url = "";
let home = "";
const repos: Repo[] = [];
let assigned: Repo;
let alpha = "";
let plain: Repo;
let loose = "";
let gone: Repo;
let goneWt = "";
let malformed: Repo;

beforeAll(async () => {
  assigned = repo("assigned");
  alpha = assigned.addWorktree("wt-alpha", "plan/demo");
  assigned.openPhase(alpha, 2);
  assigned.writeRecord([{ path: alpha, branch: "plan/demo" }]);

  plain = repo("plain");
  loose = plain.addWorktree("loose", "plan/demo");
  plain.checkOff(loose, "first item");

  gone = repo("gone");
  goneWt = gone.addWorktree("wt-gone", "plan/demo");
  gone.checkOff(goneWt, "first item");
  gone.writeRecord([{ path: goneWt, branch: "plan/demo" }]);
  git(gone.trunk, ["worktree", "remove", "--force", goneWt]);

  malformed = repo("malformed");
  malformed.addWorktree("wt-m", "plan/demo");
  malformed.writeRecordRaw("{ this is not json");

  repos.push(assigned, plain, gone, malformed);
  home = makeHome([
    { name: "assigned", path: assigned.trunk },
    { name: "plain", path: plain.trunk },
    { name: "gone", path: gone.trunk },
    { name: "malformed", path: malformed.trunk },
  ]);
  const dev = await startNextDev({ home });
  url = dev.url;
  stop = dev.stop;
}, 60_000);

afterAll(async () => {
  await stop?.();
  for (const r of repos) rmSync(r.base, { recursive: true, force: true });
  if (home) rmSync(home, { recursive: true, force: true });
});

async function page(p: string): Promise<string> {
  const res = await fetch(`${url}${p}`);
  expect(res.status, p).toBe(200);
  return res.text();
}

describe("admin-plan-worktrees over HTTP", () => {
  it("A1 — an item checked off in the assigned worktree shows as done on the next refresh", async () => {
    const before = await page(`/p/assigned/plan/${PLAN}`);
    // The count on the active phase's bar, whichever phase that is: which
    // phase is active is A4's claim, not this one's. The worktree opened
    // phase 2, so the item checked off is phase 2's.
    expect(activeBar(before)?.items).toBe("0 of 2");
    assigned.checkOff(alpha, "third item");
    const after = await page(`/p/assigned/plan/${PLAN}`);
    expect(activeBar(after)?.items).toBe("1 of 2");
  }, 60_000);

  it("A2 — the plan page names the worktree it reads from", async () => {
    const html = await page(`/p/assigned/plan/${PLAN}`);
    const at = html.indexOf('data-testid="plan-worktree"');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(html.slice(at, at + 600)).toContain("wt-alpha");
  });

  it("A3 — the sidebar row for an assigned plan names its worktree", async () => {
    const html = await page("/p/assigned");
    const at = html.indexOf('data-testid="plan-worktree"');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(html.slice(at, at + 600)).toContain("wt-alpha");
  });

  it("A4 — the active phase is the one opened in the worktree", async () => {
    const html = await page(`/p/assigned/plan/${PLAN}`);
    expect(activeBar(html)?.phase).toBe("build-2");
  });

  it("A7 — a plan with no assignment reads as today: the trunk copy, no worktree named", async () => {
    const html = await page(`/p/plain/plan/${PLAN}`);
    expect(activeBar(html)).toEqual({ phase: "build-1", items: "0 of 2" });
    const header = html.slice(0, html.indexOf('data-testid="impl-progress"'));
    expect(header).not.toContain('data-testid="plan-worktree"');
  });

  it("A14 — an assigned worktree removed without release is reported gone, and the trunk copy shown", async () => {
    const html = await page(`/p/gone/plan/${PLAN}`);
    expect(html).toContain("no longer exists");
    expect(html).toContain(goneWt);
    expect(activeBar(html)).toEqual({ phase: "build-1", items: "0 of 2" });
  });

  it("A15 — a worktree with no assignment is listed as unassigned", async () => {
    const html = await page("/p/plain");
    const at = html.indexOf("Unassigned worktrees");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(html.slice(at, at + 1500)).toContain("loose");
  });

  it("A16 — a malformed record is an error naming the file, on the project and the plan page", async () => {
    const file = malformed.recordPath();
    const project = await page("/p/malformed");
    expect(project).toContain(file);
    const plan = await page(`/p/malformed/plan/${PLAN}`);
    expect(plan).toContain(file);
    expect(activeBar(plan)).toBeNull();
  });
});
