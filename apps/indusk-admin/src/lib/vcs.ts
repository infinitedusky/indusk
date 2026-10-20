import { startProgram } from "@infinitedusky/indusk-mcp/run-record";

/**
 * Look up commit messages for commit identifiers.
 *
 * The eval agent fires on `git commit`, so the scorecard's `changeId` is the
 * commit the trigger captured. Git is the only substrate as of 1.31.0.
 *
 * A message is `null` when:
 *   - id is empty / non-alphanumeric
 *   - git does not resolve it (not a repo, unknown commit, empty message)
 *
 * The calls are read-only — `git log` never mutates — and asynchronous with the
 * package's time limit, so the page that reads them never stops the server
 * (admin-pages-load-fast, decision 15).
 */

const RECORD = "\u001e";
const FIELD = "\u001f";

const askable = (id: string) => id !== "" && /^[a-z0-9]+$/i.test(id);

/**
 * Bulk-resolve commit messages for many ids, in one `git log --no-walk` however many
 * there are. Deduplicates by id, so the same commit isn't asked twice per render, and a
 * revision git cannot resolve is left out rather than failing the rest.
 */
export async function getCommitMessages(
  projectRoot: string,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(ids)].filter(askable);
  if (wanted.length === 0) return out;
  let log: string;
  try {
    log = await startProgram(
      "git",
      [
        "log",
        "--no-walk=unsorted",
        "--ignore-missing",
        `--format=%H${FIELD}%B${RECORD}`,
        ...wanted,
      ],
      { cwd: projectRoot },
    );
  } catch {
    // git missing, not a repo, or the read did not answer
    return out;
  }
  const messages = log
    .split(RECORD)
    .map((entry) => entry.replace(/^\n+/, ""))
    .flatMap((entry) => {
      const at = entry.indexOf(FIELD);
      return at < 0
        ? []
        : [[entry.slice(0, at), entry.slice(at + 1).trim()] as const];
    });
  for (const id of wanted) {
    const found = messages.find(([hash]) =>
      hash.toLowerCase().startsWith(id.toLowerCase()),
    );
    if (found && found[1] !== "") out.set(id, found[1]);
  }
  return out;
}

/** One commit's message, or `null`; the same read as `getCommitMessages`. */
export async function getCommitMessage(
  projectRoot: string,
  id: string,
): Promise<string | null> {
  return (await getCommitMessages(projectRoot, [id])).get(id) ?? null;
}
