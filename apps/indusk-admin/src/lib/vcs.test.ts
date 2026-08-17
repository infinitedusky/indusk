import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitOnlyPath } from "./git-only-path";
import { getCommitMessage, getCommitMessages } from "./vcs";

/**
 * A3 / A4 (jj-residue-rip-out) — regression guards on commit-message lookup.
 *
 * Both pass today: `getCommitMessage` already falls back to git when jj is
 * missing or does not know the id. They are declared as guards in the impl's
 * Test Phase 1 register rather than dressed up as red tests. Their job is to
 * prove that Build Phase 1's removal of the jj branch did not break the
 * feature that branch was nominally serving.
 *
 * A3 needs jj *genuinely* absent, not mocked to fail — a mock passes against
 * code that still tries jj first, which is exactly the condition being removed.
 * jj is installed on this machine (`/opt/homebrew/bin/jj`), so the test builds
 * a PATH containing git and nothing else.
 */

/** Resolved before any PATH manipulation, so setup never depends on the stub PATH. */
const REAL_GIT = execFileSync("/bin/sh", ["-c", "command -v git"], {
  encoding: "utf-8",
}).trim();

const MESSAGE = "feat(vcs): a distinctive subject line for A4 to match";

describe("commit-message lookup", { timeout: 30000 }, () => {
  let repo: string;
  let gitOnlyBin: string;
  let gitPath: string;
  let sha: string;
  let originalPath: string | undefined;

  function git(args: string[]): string {
    return execFileSync(REAL_GIT, args, {
      cwd: repo,
      encoding: "utf-8",
    }).trim();
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "vcs-repo-"));
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@test.invalid"]);
    git(["config", "user.name", "Test"]);
    writeFileSync(join(repo, "README.md"), "# repo\n");
    git(["add", "-A"]);
    git(["commit", "-q", "-m", MESSAGE]);
    sha = git(["rev-parse", "HEAD"]);

    // A PATH with git and nothing else — jj cannot be found from here.
    gitOnlyBin = mkdtempSync(join(tmpdir(), "vcs-bin-"));
    gitPath = gitOnlyPath(join(gitOnlyBin, "bin"));

    originalPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    rmSync(repo, { recursive: true, force: true });
    rmSync(gitOnlyBin, { recursive: true, force: true });
  });

  it("A3 — displays a commit message when jj is not installed", () => {
    process.env.PATH = gitPath;

    // Guard the guard: if jj were still reachable, A3 would prove nothing.
    // Absolute /bin/sh with an explicit env — spawning bare `sh` here dies with
    // ENOENT (the narrowed PATH holds only git), and `.toThrow()` would then
    // pass on the spawn failure whether or not jj was reachable.
    const jjLookup = spawnSync("/bin/sh", ["-c", "command -v jj"], {
      env: { ...process.env, PATH: gitPath },
    });
    expect(
      jjLookup.status,
      "jj must be unreachable, or A3 proves nothing",
    ).not.toBe(0);

    expect(getCommitMessage(repo, sha)).not.toBeNull();
  });

  it("A4 — the displayed message is the commit's actual git message", () => {
    process.env.PATH = gitPath;
    expect(getCommitMessage(repo, sha)).toBe(MESSAGE);
  });

  it("A4 — bulk lookup resolves each id once and keys by id", () => {
    process.env.PATH = gitPath;
    const out = getCommitMessages(repo, [sha, sha]);
    expect(out.size).toBe(1);
    expect(out.get(sha)).toBe(MESSAGE);
  });

  it("returns null for an id no vcs resolves", () => {
    process.env.PATH = gitPath;
    expect(
      getCommitMessage(repo, "deadbeefdeadbeefdeadbeefdeadbeef"),
    ).toBeNull();
  });
});
