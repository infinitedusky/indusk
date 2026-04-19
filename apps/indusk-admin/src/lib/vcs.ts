import { execFileSync } from "node:child_process";

/**
 * Look up the commit message for a change-or-commit identifier.
 *
 * The eval agent fires on EITHER `jj describe` OR a git commit — both
 * produce a commit-like artifact with a message. The scorecard's
 * `changeId` is whichever the trigger captured. We try jj first (it's
 * the project default in dusk and InDusk-using repos) and fall back to
 * git (for repos where the trigger comes from a git commit instead).
 *
 * Returns `null` when:
 *   - neither jj nor git resolves the id
 *   - id is empty / non-alphanumeric
 *   - both lookups fail (not a vcs repo, id abandoned, etc.)
 *
 * Both calls are read-only — `jj log --ignore-working-copy` doesn't snapshot,
 * and `git log` is always read-only.
 */
export function getCommitMessage(projectRoot: string, id: string): string | null {
  if (!id || !/^[a-z0-9]+$/i.test(id)) return null;

  // Try jj first
  try {
    const out = execFileSync(
      "jj",
      ["log", "-r", id, "--no-graph", "-T", "description", "--ignore-working-copy"],
      { cwd: projectRoot, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const trimmed = out.trim();
    if (trimmed !== "") return trimmed;
  } catch {
    // jj missing or id not in jj — fall through to git
  }

  // Fall back to git
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%B", id], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = out.trim();
    if (trimmed !== "") return trimmed;
  } catch {
    // git missing or id not in git either
  }

  return null;
}

/**
 * Bulk-resolve commit messages for many ids. Deduplicates by id so the same
 * commit isn't queried twice per render.
 */
export function getCommitMessages(projectRoot: string, ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of new Set(ids)) {
    const msg = getCommitMessage(projectRoot, id);
    if (msg) out.set(id, msg);
  }
  return out;
}
