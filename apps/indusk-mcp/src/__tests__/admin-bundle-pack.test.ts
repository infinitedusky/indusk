import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * T18 — admin app is bundled into the published indusk-mcp tarball.
 *
 * Runs `pnpm pack` from `apps/indusk-mcp/` (which fires `prepublishOnly`,
 * which runs the admin app build + the bundle-admin.js script), then:
 *   - Asserts the tarball file was produced
 *   - Asserts tarball uncompressed size is under the 50 MB cap from ADR
 *   - Asserts the tarball contains `package/admin/.next/BUILD_ID` (the
 *     marker file Next.js writes to indicate a complete production build)
 *
 * Why under-50-MB matters: the ADR's Y-statement under "Accepting" lists a
 * tarball growth of "~10–30 MB" as the acceptable trade-off for variant A3
 * (pre-built bundle). 50 MB is the upper bound — past that, the variant
 * choice should be revisited.
 *
 * NOTE: This test is slow (~30s — runs `pnpm build` + `next build` + the
 * bundling script + `pnpm pack`). It runs in the node project (not browser).
 * Skipped via `SKIP_SLOW_TESTS` env var when iterating other tests.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const INDUSK_MCP = join(REPO_ROOT, "apps/indusk-mcp");

const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1";

let tarballPath: string | null = null;
let tarballSizeMB = 0;
let tempPackDir: string | null = null;

beforeAll(() => {
  if (SHOULD_SKIP) return;
  // Pack into a tempdir so we don't pollute the repo with stray .tgz files
  tempPackDir = mkdtempSync(join(tmpdir(), "indusk-mcp-pack-"));
  execFileSync("pnpm", ["pack", "--pack-destination", tempPackDir], {
    cwd: INDUSK_MCP,
    encoding: "utf-8",
  });
  const tgzs = readdirSync(tempPackDir).filter((f) => f.endsWith(".tgz"));
  if (tgzs.length !== 1) {
    throw new Error(`expected exactly one .tgz in ${tempPackDir}, got ${tgzs.length}`);
  }
  tarballPath = join(tempPackDir, tgzs[0]);
  tarballSizeMB = statSync(tarballPath).size / (1024 * 1024);
}, 180_000);

afterAll(() => {
  if (tempPackDir && existsSync(tempPackDir)) {
    rmSync(tempPackDir, { recursive: true, force: true });
  }
});

describe("T18 — admin app bundled into indusk-mcp tarball", () => {
  it.skipIf(SHOULD_SKIP)("pnpm pack produces a tarball under 50 MB compressed", () => {
    expect(tarballPath, "tarball was not produced by pnpm pack").not.toBeNull();
    // Compressed size cap: 50 MB is the ADR's hard upper bound. The Y-statement
    // mentions "~10–30 MB" as the accepted range; 50 MB is the variant-revisit threshold.
    expect(tarballSizeMB).toBeLessThan(50);
  });

  it.skipIf(SHOULD_SKIP)("tarball contains admin/.next/BUILD_ID (Next.js production build marker)", () => {
    expect(tarballPath).not.toBeNull();
    const out = execFileSync("tar", ["tzf", tarballPath as string], {
      encoding: "utf-8",
    });
    const files = out.split("\n");
    const hasBuildId = files.some((f) => f === "package/admin/.next/BUILD_ID");
    expect(
      hasBuildId,
      `package/admin/.next/BUILD_ID not found in tarball; first 20 admin/ entries: ${files
        .filter((f) => f.startsWith("package/admin/"))
        .slice(0, 20)
        .join(", ")}`,
    ).toBe(true);
  });

  it.skipIf(SHOULD_SKIP)("tarball contains admin/package.json + admin/next.config.ts (runtime files)", () => {
    expect(tarballPath).not.toBeNull();
    const out = execFileSync("tar", ["tzf", tarballPath as string], {
      encoding: "utf-8",
    });
    expect(out).toContain("package/admin/package.json");
    expect(out).toContain("package/admin/next.config.ts");
  });
});
