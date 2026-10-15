// promise: a-plan-reads-by-its-title
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readActivePlans } from "./planning-reader";

/**
 * plan-stories A13: a plan worked in its own worktree is named by the title
 * written in that worktree's brief, not the trunk's. A real repository, as
 * `planning-reader.own-branch.test.ts` builds one: the plan committed on the
 * trunk with one title, a worktree on `plan/p` whose brief says another, and
 * the assignment record written by hand.
 */

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  }).trim();

describe("a worktree plan is named by its worktree's brief", () => {
  it("A13 names a worktree plan by its worktree's brief", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "title-worktree-")));
    dirs.push(base);
    const root = join(base, "proj");
    mkdirSync(join(root, ".indusk", "planning", "p"), { recursive: true });
    writeFileSync(
      join(root, ".indusk", "config.json"),
      '{ "mode": "full" }\n',
    );
    writeFileSync(
      join(root, ".indusk", "planning", "p", "brief.md"),
      '---\ntitle: "Trunk name"\nstatus: draft\n---\n\n# p\n',
    );
    git(root, "init", "-q", "-b", "main");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "init");
    const wt = join(base, "proj-worktrees", "p");
    git(root, "worktree", "add", "-q", wt, "-b", "plan/p", "main");
    writeFileSync(
      join(wt, ".indusk", "planning", "p", "brief.md"),
      '---\ntitle: "Worktree name"\ndescription: "From the worktree."\nstatus: draft\n---\n\n# p\n',
    );
    const common = git(
      root,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    );
    writeFileSync(
      join(common, "indusk-plan-worktrees.json"),
      JSON.stringify({
        version: 1,
        assignments: [
          {
            plan: "p",
            path: realpathSync(wt),
            branch: "plan/p",
            at: "2026-10-06T00:00:00Z",
          },
        ],
      }),
    );
    const [p] = await readActivePlans(root);
    expect(p?.title).toBe("Worktree name");
    expect(p?.description).toBe("From the worktree.");
  });
});
