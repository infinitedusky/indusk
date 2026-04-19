import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * HTTP-level smoke test for the served admin UI.
 *
 * This test catches the class of bug that pure component tests cannot:
 * the rendered React tree may be perfect in isolation, but if the Next.js
 * route file resolves the project root incorrectly (or any other server-
 * boundary mistake happens), the served URL returns 404 / wrong content
 * even though all 60+ component tests pass green.
 *
 * Concrete bug this catches: Phase 6 originally read `process.cwd()` in
 * `app/layout.tsx` and `app/plan/[name]/page.tsx`. Because `indusk ui`
 * spawns `next dev` from `apps/indusk-admin/`, `process.cwd()` was the
 * admin app dir, not the user's project root — so planning-reader read
 * an empty `.indusk/planning/` and every plan URL returned 404. The fix
 * threads `INDUSK_PROJECT_ROOT` env var via `getProjectRoot()`. This test
 * spawns the actual `next dev` from inside the dusk repo and asserts
 * the served pages return 200 with expected content.
 *
 * NOTE: This is the slowest test in the suite (~10s for next dev to boot).
 * It runs in the node project; component tests still cover the React tree.
 */

const ADMIN_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(ADMIN_ROOT, "../..");

let server: ChildProcess | null = null;
let port = 0;

beforeAll(async () => {
  port = await findFreePort();
  server = spawn(
    "pnpm",
    ["exec", "next", "dev", "--port", String(port)],
    {
      cwd: ADMIN_ROOT,
      env: {
        ...process.env,
        INDUSK_PROJECT_ROOT: REPO_ROOT,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  // Wait for "Ready" in stdout (timeout 30s)
  await new Promise<void>((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => rejectReady(new Error("next dev did not become ready in 30s")), 30_000);
    server?.stdout?.on("data", (chunk) => {
      if (/✓ Ready in/.test(chunk.toString())) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
    server?.on("error", rejectReady);
  });
  // Small additional buffer so first request doesn't race the listener bind
  await sleep(500);
}, 60_000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await sleep(200);
    if (!server.killed) server.kill("SIGKILL");
  }
});

describe("HTTP smoke — served admin UI is reachable and returns expected content", () => {
  it("GET / returns 200 with the populated sidebar", async () => {
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Sidebar must have rendered ACTUAL plans, not the empty state.
    // If process.cwd() / INDUSK_PROJECT_ROOT regresses, this flips to
    // sidebar-empty-state and this assertion catches the regression.
    expect(html, "sidebar should not be in empty-state").not.toContain(
      'data-testid="sidebar-empty-state"',
    );
    expect(html).toContain('data-testid="active-plans"');
  });

  it("GET /plan/indusk-admin-ui returns 200 with all expected detail sections", async () => {
    const res = await fetch(`http://localhost:${port}/plan/indusk-admin-ui`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // The plan detail must include header + brief + phases + falsification.
    // Each missing section here would mean the planning-reader couldn't
    // resolve / parse the plan from disk.
    expect(html).toContain('data-testid="plan-detail"');
    expect(html).toContain('data-testid="plan-header"');
    expect(html).toContain('data-testid="brief-section"');
    expect(html).toContain('data-testid="phases-section"');
    expect(html).toContain('data-testid="falsification-section"');
  });

  it("GET /plan/this-plan-does-not-exist returns 404", async () => {
    const res = await fetch(`http://localhost:${port}/plan/this-plan-does-not-exist`);
    expect(res.status).toBe(404);
  });
});

function findFreePort(): Promise<number> {
  return new Promise((resolveProm, rejectProm) => {
    const srv = createServer();
    srv.once("error", rejectProm);
    srv.listen(0, () => {
      const addr = srv.address();
      if (typeof addr === "object" && addr !== null) {
        const p = addr.port;
        srv.close(() => resolveProm(p));
      } else {
        rejectProm(new Error("Could not determine free port"));
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
