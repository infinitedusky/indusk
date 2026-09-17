import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * admin-ui-phase-progress — A25.
 *
 * The admin's `tsc --noEmit` had been red since 2026-08-12 (ten hand-written
 * `TrajectoryRow` fixtures without the parser's `writableAtKind` /
 * `passesAtKind`) and nothing in the suite noticed, because no test ran the
 * type-check. This one does. It is deliberately a test rather than a turbo
 * task so that `pnpm test` — the thing every phase's Verification runs — is
 * what keeps it green.
 */

const ADMIN_ROOT = resolve(__dirname, "../..");

describe("A25 — the admin type-checks clean", () => {
  it("pnpm exec tsc --noEmit -p . exits 0", { timeout: 180_000 }, () => {
    const r = spawnSync("pnpm", ["exec", "tsc", "--noEmit", "-p", "."], {
      cwd: ADMIN_ROOT,
      encoding: "utf-8",
    });
    expect(r.status, `tsc reported errors:\n${r.stdout}\n${r.stderr}`).toBe(0);
  });
});
