import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * T15 — The `/scorecards` page lists every scorecard from every registered
 * project's `.indusk/eval/results.log`, labeled with project name on each
 * card, sorted most-recent-first across all projects.
 *
 * Setup: register two fixture projects, seed each with a different
 * scorecard entry in `.indusk/eval/results.log`, hit /scorecards, and
 * assert both project names appear labeling their respective cards.
 */

const ADMIN_ROOT = path.resolve(__dirname, "../../..");

let server: ChildProcess | null = null;
let port = 0;
let testHome = "";
let projA = "";
let projB = "";

beforeAll(async () => {
  testHome = mkdtempSync(path.join(tmpdir(), "indusk-home-"));
  projA = mkdtempSync(path.join(tmpdir(), "proj-a-"));
  projB = mkdtempSync(path.join(tmpdir(), "proj-b-"));

  // Seed each project's eval log with a scorecard. Shape per
  // planning-reader's scorecard parser: JSONL with timestamps.
  for (const [proj, marker] of [
    [projA, "alpha-specific-marker"],
    [projB, "beta-specific-marker"],
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
}, 60_000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await sleep(200);
    if (!server.killed) server.kill("SIGKILL");
  }
  if (testHome) rmSync(testHome, { recursive: true, force: true });
  if (projA) rmSync(projA, { recursive: true, force: true });
  if (projB) rmSync(projB, { recursive: true, force: true });
});

describe("Scorecards /scorecards — T15: cross-project walk with project labels", () => {
  it("T15 — GET /scorecards lists scorecards from both registered projects with their project labels", async () => {
    const res = await fetch(`http://localhost:${port}/scorecards`);
    expect(res.status).toBe(200);
    const html = await res.text();

    // Both project-specific summaries must appear
    expect(html).toContain("alpha-specific-marker");
    expect(html).toContain("beta-specific-marker");

    // Both project labels must appear — `data-testid="scorecard-project-label"`
    // is the marker the new Scorecards.tsx surface produces per row.
    expect(html).toContain("proj-a");
    expect(html).toContain("proj-b");
    expect(html).toContain('data-testid="scorecard-project-label"');
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
