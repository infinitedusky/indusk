import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * T11 — HTTP end-to-end: registered project whose path is deleted returns
 * HTTP 200 with the stale-project failure page marker (not 500).
 *
 * Setup: register a project path that exists at registration time, boot
 * next dev, then delete the project's dir. Hit `/p/{name}/` and assert on
 * the `data-testid="stale-project-failure"` marker.
 */

const ADMIN_ROOT = path.resolve(__dirname, "../..");
const STALE_NAME = "stale-fixture-proj";

let server: ChildProcess | null = null;
let port = 0;
let testHome = "";
let staleProjectPath = "";

beforeAll(async () => {
  testHome = mkdtempSync(path.join(tmpdir(), "indusk-home-"));
  // Register a project at a path that will EXIST at boot but be deleted
  // before the request. The registry itself is never auto-pruned.
  staleProjectPath = mkdtempSync(path.join(tmpdir(), "stale-"));
  mkdirSync(path.join(staleProjectPath, ".indusk/planning"), {
    recursive: true,
  });
  writeFileSync(
    path.join(testHome, "projects.json"),
    JSON.stringify({
      version: 1,
      projects: [
        {
          name: STALE_NAME,
          path: staleProjectPath,
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
  await sleep(500);

  // NOW delete the registered path — simulates the user renaming or
  // moving the project dir after registration. The registry still
  // references the old location.
  rmSync(staleProjectPath, { recursive: true, force: true });
}, 60_000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await sleep(200);
    if (!server.killed) server.kill("SIGKILL");
  }
  if (testHome) rmSync(testHome, { recursive: true, force: true });
});

describe("HTTP — T11: stale-project path returns 200 with failure page", () => {
  it(`GET /p/${STALE_NAME}/ returns 200 with the failure marker`, async () => {
    const res = await fetch(`http://localhost:${port}/p/${STALE_NAME}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-testid="stale-project-failure"');
    expect(html).toContain(STALE_NAME);
  });

  it("GET /p/never-registered/ returns 200 with the failure marker (unregistered name)", async () => {
    const res = await fetch(`http://localhost:${port}/p/never-registered/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-testid="stale-project-failure"');
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
