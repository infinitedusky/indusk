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
import { readActivePlans } from "../planning-reader";

/**
 * promise: a-plan-is-written-on-its-own-branch — admin-plan-authoring A7, the admin's reader.
 *
 * A plan started on its own branch has no folder on the trunk until it is
 * approved. The package's reader finds it through its assignment; the
 * admin's sidebar and plan page must too, or New plan opens a 404.
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

describe("a plan on its own branch is read from its worktree", () => {
  it("appears among the active plans, read from the worktree", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "own-branch-")));
    dirs.push(base);
    const trunk = join(base, "proj");
    mkdirSync(join(trunk, ".indusk", "planning"), { recursive: true });
    writeFileSync(
      join(trunk, ".indusk", "config.json"),
      '{ "mode": "full" }\n',
    );
    writeFileSync(join(trunk, ".indusk", "planning", "master.md"), "# plans\n");
    git(trunk, "init", "-q", "-b", "main");
    git(trunk, "add", "-A");
    git(trunk, "commit", "-qm", "init");
    const wt = join(base, "proj-worktrees", "seats");
    git(trunk, "worktree", "add", "-q", wt, "-b", "plan/seats", "main");
    mkdirSync(join(wt, ".indusk", "planning", "seats"), { recursive: true });
    writeFileSync(
      join(wt, ".indusk", "planning", "seats", "brief.md"),
      "---\ntitle: seats\nstatus: draft\nworkflow: bugfix\n---\n\n# seats\n",
    );
    const common = git(
      trunk,
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
            plan: "seats",
            path: realpathSync(wt),
            branch: "plan/seats",
            at: "2026-10-06T00:00:00Z",
          },
        ],
      }),
    );
    const plans = await readActivePlans(trunk);
    const seats = plans.find((p) => p.name === "seats");
    expect(seats, plans.map((p) => p.name).join(", ")).toBeDefined();
    expect(seats?.worktree?.path).toBe(realpathSync(wt));
    expect(seats?.brief).toBeDefined();
  });
});
