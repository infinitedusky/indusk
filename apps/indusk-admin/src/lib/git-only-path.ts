import { spawnSync } from "node:child_process";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Populate `binDir` with a `git` symlink and return it as a `PATH` value from
 * which git resolves and `jj` does not.
 *
 * A3 needs jj *genuinely* absent rather than mocked to fail — a mock passes
 * against code that still tries jj first, which is the condition the
 * jj-residue-rip-out plan removed. So the precondition has to actually hold.
 *
 * Builds an allow-list rather than subtracting from the ambient PATH. The
 * implementation this replaced (`pathWithoutJj()` in indusk-mcp's test helpers,
 * now deleted) filtered out *jj's directory*, which fails two ways:
 *
 *   1. It removes git too whenever they share a directory — Homebrew installs
 *      both into `/opt/homebrew/bin` by default.
 *   2. It located jj by spawning bare `which`, so once a caller had already
 *      narrowed PATH, `which` itself became unresolvable, the lookup failed,
 *      and the function returned **PATH unchanged** — leaving jj reachable
 *      while reporting success. A precondition that silently does not hold is
 *      worse than one that fails loudly, because every assertion downstream
 *      still passes.
 *
 * Hence: resolve git through an absolute `/bin/sh` so this never depends on the
 * caller's PATH, and throw rather than degrade if git cannot be found.
 *
 * The caller owns `binDir`'s lifecycle — it is expected to be a temp directory
 * the test already creates and removes.
 */
export function gitOnlyPath(binDir: string): string {
  const found = spawnSync("/bin/sh", ["-c", "command -v git"], {
    encoding: "utf-8",
  });
  if (found.status !== 0 || found.stdout.trim() === "") {
    throw new Error(
      "gitOnlyPath: git not found — refusing to return a PATH that still has jj",
    );
  }
  mkdirSync(binDir, { recursive: true });
  symlinkSync(found.stdout.trim(), join(binDir, "git"));
  return binDir;
}
