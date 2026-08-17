import { execFileSync } from "node:child_process";

/**
 * Look up the commit message for a commit identifier.
 *
 * The eval agent fires on `git commit`, so the scorecard's `changeId` is the
 * commit the trigger captured. Git is the only substrate as of 1.31.0.
 *
 * Returns `null` when:
 *   - id is empty / non-alphanumeric
 *   - git does not resolve it (not a repo, unknown commit, empty message)
 *
 * The call is read-only — `git log` never mutates.
 */
export function getCommitMessage(
  projectRoot: string,
  id: string,
): string | null {
  if (!id || !/^[a-z0-9]+$/i.test(id)) return null;

  try {
    const out = execFileSync("git", ["log", "-1", "--format=%B", id], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = out.trim();
    if (trimmed !== "") return trimmed;
  } catch {
    // git missing, not a repo, or id unknown
  }

  return null;
}

/**
 * Bulk-resolve commit messages for many ids. Deduplicates by id so the same
 * commit isn't queried twice per render.
 */
export function getCommitMessages(
  projectRoot: string,
  ids: string[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of new Set(ids)) {
    const msg = getCommitMessage(projectRoot, id);
    if (msg) out.set(id, msg);
  }
  return out;
}
