import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * promise: one-definition-per-shared-rule — admin-plan-authoring A25.
 *
 * The admin starts plans, approves and lands them, and starts `claude` — but
 * only through the package's own code (`@infinitedusky/indusk-mcp/plans`,
 * `/session`). A second spelling here of how a worktree is made, a plan is
 * merged or a session is driven would drift from the one the CLI and the
 * skills use, and nothing would say so.
 *
 * Two read-only `git` readers already exist and are the only files allowed
 * to start a process. A regression guard: it passes on today's tree, which
 * has no write code, and stays green as the routes and the runner arrive.
 */

const SRC = join(__dirname, "..");

/** The admin's own files, without its tests or test helpers. */
function sources(dir = SRC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") sources(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const READ_ONLY_GIT = ["lib/git-only-path.ts", "lib/vcs.ts"];

describe("A25 — the admin acts only through the package", () => {
  it("only the two read-only git readers start a process", () => {
    const spawning = sources()
      .filter((f) =>
        /from ["']node:child_process["']|require\(["']child_process["']\)/.test(
          readFileSync(f, "utf-8"),
        ),
      )
      .map((f) => relative(SRC, f))
      .sort();
    expect(spawning).toEqual(READ_ONLY_GIT);
  });

  it("the read-only readers never make a worktree, merge, or start claude", () => {
    for (const rel of READ_ONLY_GIT) {
      const text = readFileSync(join(SRC, rel), "utf-8");
      expect(text, rel).not.toMatch(
        /["']worktree["']|["']merge["']|["']claude["']/,
      );
    }
  });

  it("plans and sessions are imported from the package, never from a module of the admin's own", () => {
    const local = sources()
      .filter((f) =>
        /from ["'](?:@\/|\.{1,2}\/)(?:[\w-]+\/)*lib\/(?:plans|session)(?:\/|["'])/.test(
          readFileSync(f, "utf-8"),
        ),
      )
      .map((f) => relative(SRC, f));
    expect(local).toEqual([]);
  });
});
