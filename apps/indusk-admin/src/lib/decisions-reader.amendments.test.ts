// promise: decisions-wait-in-one-place
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "./planning-reader";

vi.mock("./session-host", () => ({
  sessionManager: () => ({ current: () => null, pendingQuestion: () => null }),
}));
vi.mock("./build-host", () => ({ buildState: () => null }));

import { readWaiting } from "./decisions-reader";

/**
 * plan-stories A27: the admin's own amendment lookup (`readWaiting`, through
 * `amendmentCounts`), run over a real git repository and a real worktree: a
 * plan whose brief changed after approval waits on its amendment, read in the
 * checkout the plan is worked in; a plan whose brief is unchanged, or whose
 * approval cannot be read, waits on nothing.
 */

const BRIEF = (lead: string) =>
  `# Brief\n\n## Expectations\n\n1. **${lead}** The page answers.\n\n## Promises\n\n### This plan makes\n\nNone — nothing new.\n`;

let base: string;
let project: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    encoding: "utf-8",
  });

const writePlan = (checkout: string, brief: string, impl?: string) => {
  const dir = join(checkout, ".indusk", "planning", "p");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.md"), brief);
  if (impl !== undefined) writeFileSync(join(dir, "impl.md"), impl);
  return dir;
};

const planIn = (worktree?: string) =>
  ({
    name: "p",
    ...(worktree ? { worktree: { path: worktree } } : {}),
  }) as unknown as Plan;

/** Approve the brief in the project (as `plans approve` does), then work the plan in a worktree. */
function approved(subject = "plan(p): impl approved") {
  const brief = BRIEF("Reads fast");
  // What `plans approve` records: the brief's sha256, as a quoted string.
  const hash = createHash("sha256").update(brief).digest("hex");
  writePlan(
    project,
    brief,
    `---\nstatus: approved\napproved_brief: "${hash}"\n---\n\n# impl\n`,
  );
  git(project, "add", "-A");
  git(project, "commit", "-q", "-m", subject);
  const worktree = join(base, "wt");
  git(project, "worktree", "add", "-q", "-b", "plan/p", worktree);
  return worktree;
}

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "reader-amendments-")));
  project = join(base, "project");
  mkdirSync(project);
  git(project, "init", "-q", "-b", "main");
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("the admin finds a plan waiting on its amendment in its worktree", () => {
  it("A27 a brief changed in the plan's worktree waits on the amendment, at the Brief step", async () => {
    const worktree = approved();
    writePlan(worktree, BRIEF("Reads in five seconds"));
    const waiting = await readWaiting("proj", project, [planIn(worktree)]);
    expect(waiting.map((w) => [w.plan, w.on, w.step])).toEqual([
      ["p", "amendment", "Brief"],
    ]);
  });

  it("A27 the project's own unchanged copy is not read for a plan worked in a worktree", async () => {
    const worktree = approved();
    writePlan(worktree, BRIEF("Reads in five seconds"));
    expect(await readWaiting("proj", project, [planIn()])).toEqual([]);
  });

  it("A27 an unchanged brief waits on nothing, and so does an approval that cannot be read", async () => {
    const worktree = approved();
    expect(await readWaiting("proj", project, [planIn(worktree)])).toEqual([]);

    rmSync(base, { recursive: true, force: true });
    base = realpathSync(mkdtempSync(join(tmpdir(), "reader-amendments-")));
    project = join(base, "project");
    mkdirSync(project);
    git(project, "init", "-q", "-b", "main");
    const unreadable = approved("wip: not an approval");
    writePlan(unreadable, BRIEF("Reads in five seconds"));
    expect(await readWaiting("proj", project, [planIn(unreadable)])).toEqual(
      [],
    );
  });
});
