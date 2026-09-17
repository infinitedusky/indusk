import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startNextDev } from "./helpers/next-dev";

/**
 * T11 — HTTP end-to-end: registered project whose path is deleted returns
 * HTTP 200 with the stale-project failure page marker (not 500).
 *
 * Setup: register a project path that exists at registration time, boot
 * next dev, then delete the project's dir. Hit `/p/{name}/` and assert on
 * the `data-testid="stale-project-failure"` marker.
 */

const _ADMIN_ROOT = path.resolve(__dirname, "../..");
const STALE_NAME = "stale-fixture-proj";

let stop: (() => Promise<void>) | null = null;
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

  const dev = await startNextDev({ home: testHome });
  port = dev.port;
  stop = dev.stop;

  // NOW delete the registered path — simulates the user renaming or
  // moving the project dir after registration. The registry still
  // references the old location.
  rmSync(staleProjectPath, { recursive: true, force: true });
}, 60_000);

afterAll(async () => {
  await stop?.();
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
