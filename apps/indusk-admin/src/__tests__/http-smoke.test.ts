import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * HTTP-level smoke test for the served admin UI.
 *
 * This test catches the class of bug that pure component tests cannot:
 * the rendered React tree may be perfect in isolation, but if Next.js
 * route resolution, the registry lookup, or any other server-boundary
 * stitch is wrong, the served URL returns 404 / wrong content even though
 * every component test passes green.
 *
 * Concrete bug this catches (from the 1.26.0 failure mode): `app/layout.tsx`
 * originally read `process.cwd()` to locate planning data. Because the daemon
 * spawns `next start` from `apps/indusk-admin/` (not the user project), plans
 * never resolved and every URL 404'd. The registry-backed `getProjectPath`
 * replaces that; this test asserts the 1.27 shape holds end-to-end.
 *
 * Setup: writes a temp `~/.indusk/projects.json` registry pointing at the
 * dusk repo under the name "dusk", boots `next dev`, and asserts the new
 * /p/[project]/... routes.
 *
 * NOTE: This is the slowest test in the suite (~10s for next dev to boot).
 * It runs in the node project; component tests still cover the React tree.
 */

const ADMIN_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(ADMIN_ROOT, "../..");
const PROJECT_NAME = "dusk";

let server: ChildProcess | null = null;
let port = 0;
let testHome = "";

beforeAll(async () => {
  // Temp INDUSK_HOME with a registry entry pointing at the dusk repo itself.
  testHome = mkdtempSync(path.join(tmpdir(), "indusk-home-"));
  writeFileSync(
    path.join(testHome, "projects.json"),
    JSON.stringify({
      version: 1,
      projects: [
        {
          name: PROJECT_NAME,
          path: REPO_ROOT,
          registeredAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
      ],
    }),
  );

  port = await findFreePort();
  server = spawn("pnpm", ["exec", "next", "dev", "--port", String(port)], {
    cwd: ADMIN_ROOT,
    env: {
      ...process.env,
      INDUSK_HOME: testHome,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Wait for "Ready" in stdout (timeout 30s)
  await new Promise<void>((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new Error("next dev did not become ready in 30s")),
      30_000,
    );
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
  if (testHome) rmSync(testHome, { recursive: true, force: true });
});

describe("HTTP smoke — served admin UI is reachable and returns expected content", () => {
  it("GET / returns 200 with the project grid (1 registered project)", async () => {
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Homepage is now the project grid; the dusk project must appear.
    expect(html).toContain('data-testid="project-grid"');
    expect(html).toContain(`data-project-name="${PROJECT_NAME}"`);
  });

  it(`GET /p/${PROJECT_NAME}/ returns 200 with populated sidebar`, async () => {
    const res = await fetch(`http://localhost:${port}/p/${PROJECT_NAME}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Sidebar must render ACTUAL plans — if registry lookup / planning-reader
    // regresses, this flips to sidebar-empty-state.
    expect(html, "sidebar should not be in empty-state").not.toContain(
      'data-testid="sidebar-empty-state"',
    );
    expect(html).toContain('data-testid="active-plans"');
  });

  it(`GET /p/${PROJECT_NAME}/plan/indusk-admin-ui returns 200 with detail sections`, async () => {
    const res = await fetch(
      `http://localhost:${port}/p/${PROJECT_NAME}/plan/indusk-admin-ui`,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-testid="plan-detail"');
    expect(html).toContain('data-testid="plan-header"');
    expect(html).toContain('data-testid="brief-section"');
    expect(html).toContain('data-testid="phases-section"');
    expect(html).toContain('data-testid="falsification-section"');
  });

  it(`GET /p/${PROJECT_NAME}/plan/this-plan-does-not-exist returns 404`, async () => {
    const res = await fetch(
      `http://localhost:${port}/p/${PROJECT_NAME}/plan/this-plan-does-not-exist`,
    );
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
