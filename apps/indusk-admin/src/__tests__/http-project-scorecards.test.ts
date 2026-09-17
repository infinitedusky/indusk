import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startNextDev } from "./helpers/next-dev";

/**
 * T19 (Phase 6) — Scorecards become project-siloed.
 *
 *   - `/p/{project}/scorecards` renders ONLY that project's scorecards.
 *   - The top-level `/scorecards` route is removed (404) — no cross-project view.
 *
 * Setup mirrors `http-scorecards-cross-project.test.ts`: register two fixture
 * projects with distinct scorecard markers; `INDUSK_HOME` redirects away from
 * the real `~/.indusk/`.
 *
 * Red state today:
 *   - /p/{project}/scorecards does not exist → Next returns a 404 HTML page.
 *   - /scorecards still exists from Phase 4 → returns 200 with BOTH projects' data.
 *
 * Green state after Phase 6:
 *   - /p/proj-a/scorecards returns 200 with only alpha-marker content.
 *   - /p/proj-b/scorecards returns 200 with only beta-marker content.
 *   - /scorecards returns 404 (top-level route removed).
 */

const _ADMIN_ROOT = path.resolve(__dirname, "../..");

let stop: (() => Promise<void>) | null = null;
let port = 0;
let testHome = "";
let projA = "";
let projB = "";

beforeAll(async () => {
  testHome = mkdtempSync(path.join(tmpdir(), "indusk-home-"));
  projA = mkdtempSync(path.join(tmpdir(), "proj-a-"));
  projB = mkdtempSync(path.join(tmpdir(), "proj-b-"));

  for (const [proj, marker] of [
    [projA, "alpha-project-siloed-marker"],
    [projB, "beta-project-siloed-marker"],
  ] as const) {
    mkdirSync(path.join(proj, ".indusk/eval"), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      changeId: `${marker}-change`,
      summary: marker,
      questions: [],
      mode: "eval",
    };
    appendFileSync(
      path.join(proj, ".indusk/eval/results.log"),
      `${JSON.stringify(entry)}\n`,
    );
  }

  writeFileSync(
    path.join(testHome, "projects.json"),
    JSON.stringify({
      version: 1,
      projects: [
        {
          name: "proj-a",
          path: projA,
          registeredAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        {
          name: "proj-b",
          path: projB,
          registeredAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
      ],
    }),
  );

  const dev = await startNextDev({ home: testHome });
  port = dev.port;
  stop = dev.stop;
}, 60_000);

afterAll(async () => {
  await stop?.();
  if (testHome) rmSync(testHome, { recursive: true, force: true });
  if (projA) rmSync(projA, { recursive: true, force: true });
  if (projB) rmSync(projB, { recursive: true, force: true });
});

describe("T19 — scorecards become project-siloed under /p/{project}/scorecards", () => {
  it("GET /p/proj-a/scorecards returns 200 with ONLY proj-a's scorecards", async () => {
    const res = await fetch(`http://localhost:${port}/p/proj-a/scorecards`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("alpha-project-siloed-marker");
    expect(html).not.toContain("beta-project-siloed-marker");
  });

  it("GET /p/proj-b/scorecards returns 200 with ONLY proj-b's scorecards", async () => {
    const res = await fetch(`http://localhost:${port}/p/proj-b/scorecards`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("beta-project-siloed-marker");
    expect(html).not.toContain("alpha-project-siloed-marker");
  });

  it("GET /scorecards (top-level) returns 404 — cross-project view removed", async () => {
    const res = await fetch(`http://localhost:${port}/scorecards`);
    expect(res.status).toBe(404);
  });

  it("the per-project sidebar on /p/{project}/ contains a link to /p/{project}/scorecards", async () => {
    const res = await fetch(`http://localhost:${port}/p/proj-a/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="/p/proj-a/scorecards"');
  });
});
