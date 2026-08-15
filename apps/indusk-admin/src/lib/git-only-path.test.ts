import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitOnlyPath } from "./git-only-path";

/**
 * A12 (jj-residue-rip-out, cleanup) — a jj-absent PATH must still resolve git
 * when both binaries live in the same directory.
 *
 * The implementation this replaced stripped jj's *directory* from PATH, which
 * removes git too whenever they share one. Homebrew installs both into
 * `/opt/homebrew/bin` by default, so that is the common case, not an exotic
 * one; it passed on the authoring machine only because git was at
 * `/usr/bin/git`.
 *
 * The test plants both binaries in one directory rather than depending on
 * where this machine happens to keep them — a test that only passes on the
 * author's layout is what let the defect survive.
 */

const REAL_GIT = execFileSync("/bin/sh", ["-c", "command -v git"], {
  encoding: "utf-8",
}).trim();

describe("gitOnlyPath", { timeout: 30000 }, () => {
  let sharedBin: string;
  let originalPath: string | undefined;

  /**
   * Can `bin` be resolved from `path`?
   *
   * Uses an absolute `/bin/sh` and an explicit `env`, never the ambient PATH.
   * An earlier version spawned bare `sh` while `process.env.PATH` pointed at a
   * directory containing only git and jj — so it died with `spawnSync sh
   * ENOENT` and both assertions "failed" without ever running. A red that is
   * really a setup failure proves nothing.
   */
  function resolvesOn(path: string, bin: string): boolean {
    const res = spawnSync("/bin/sh", ["-c", `command -v ${bin} >/dev/null`], {
      env: { ...process.env, PATH: path },
    });
    return res.status === 0;
  }

  beforeEach(() => {
    // One directory holding BOTH git and jj — the Homebrew layout — and it is
    // the *only* thing on PATH, which is also the state a previously-narrowed
    // PATH leaves behind.
    sharedBin = mkdtempSync(join(tmpdir(), "shared-bin-"));
    mkdirSync(join(sharedBin, "bin"), { recursive: true });
    symlinkSync(REAL_GIT, join(sharedBin, "bin", "git"));
    writeFileSync(join(sharedBin, "bin", "jj"), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });

    originalPath = process.env.PATH;
    process.env.PATH = join(sharedBin, "bin");
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    rmSync(sharedBin, { recursive: true, force: true });
  });

  it("A12 — git still resolves when git and jj share a directory", () => {
    const path = gitOnlyPath(join(sharedBin, "out"));
    expect(
      resolvesOn(path, "git"),
      "git must survive — removing jj must not remove git",
    ).toBe(true);
  });

  it("A12 — jj does not resolve", () => {
    const path = gitOnlyPath(join(sharedBin, "out2"));
    expect(
      resolvesOn(path, "jj"),
      "jj must be unreachable, or A3 proves nothing",
    ).toBe(false);
  });
});
