import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * T20 (Phase 6) — Per-project research section.
 *
 *   - `/p/{project}/research/{slug}` renders a markdown file from that
 *     project's `.indusk/research/` directory via the <Markdown> component.
 *   - The per-project sidebar has a "Research" group listing every top-level
 *     `.md` slug under `.indusk/research/`; empty state omits the group.
 *   - Missing slug returns 404.
 *
 * Setup: register two fixture projects. Project A has a research dir with
 * two files (anchor-pattern.md, world-models.md); project B has no research
 * dir. INDUSK_HOME redirects the registry.
 *
 * Red state today:
 *   - /p/proj-a/research/anchor-pattern does not exist → 404 with Next's
 *     default body (not our Markdown render).
 *   - Sidebar on /p/proj-a/ does NOT contain a "Research" group.
 *
 * Green state after Phase 6:
 *   - /p/proj-a/research/anchor-pattern returns 200 with rendered markdown.
 *   - /p/proj-a/research/nonexistent returns 404.
 *   - /p/proj-b/ sidebar has NO Research group (empty state).
 *   - /p/proj-a/ sidebar contains a "Research" group with both slugs.
 */

const ADMIN_ROOT = path.resolve(__dirname, "../..");

let server: ChildProcess | null = null;
let port = 0;
let testHome = "";
let projA = "";
let projB = "";

beforeAll(async () => {
  testHome = mkdtempSync(path.join(tmpdir(), "indusk-home-"));
  projA = mkdtempSync(path.join(tmpdir(), "proj-a-"));
  projB = mkdtempSync(path.join(tmpdir(), "proj-b-"));

  // Project A gets a research dir with two top-level .md files.
  mkdirSync(path.join(projA, ".indusk/research"), { recursive: true });
  writeFileSync(
    path.join(projA, ".indusk/research/anchor-pattern.md"),
    "# Anchor Pattern\n\nAnchors are load-bearing for identity.\n",
  );
  writeFileSync(
    path.join(projA, ".indusk/research/world-models.md"),
    "# World Models\n\nJEPA-style prediction.\n",
  );

  // Project B deliberately has no .indusk/research/ — tests empty state.
  mkdirSync(path.join(projB, ".indusk"), { recursive: true });

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

describe("T20 — per-project research route and sidebar group", () => {
  it("GET /p/proj-a/research/anchor-pattern returns 200 with rendered markdown", async () => {
    const res = await fetch(
      `http://localhost:${port}/p/proj-a/research/anchor-pattern`,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    // H1 rendered via <Markdown>
    expect(html).toContain("Anchor Pattern");
    // Body content
    expect(html).toContain("load-bearing for identity");
  });

  it("GET /p/proj-a/research/world-models returns 200 with that slug's content (not anchor-pattern's)", async () => {
    const res = await fetch(
      `http://localhost:${port}/p/proj-a/research/world-models`,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("World Models");
    expect(html).toContain("JEPA-style prediction");
  });

  it("GET /p/proj-a/research/does-not-exist returns 404", async () => {
    const res = await fetch(
      `http://localhost:${port}/p/proj-a/research/does-not-exist`,
    );
    expect(res.status).toBe(404);
  });

  it("the /p/proj-a/ sidebar contains a Research group with both slug links", async () => {
    const res = await fetch(`http://localhost:${port}/p/proj-a/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Research");
    expect(html).toContain('href="/p/proj-a/research/anchor-pattern"');
    expect(html).toContain('href="/p/proj-a/research/world-models"');
  });

  it("the /p/proj-b/ sidebar does NOT contain a Research group (empty state)", async () => {
    const res = await fetch(`http://localhost:${port}/p/proj-b/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // No "Research" heading in the rendered HTML — the group is omitted
    // entirely when the project has no .indusk/research/ directory.
    expect(html).not.toMatch(/>Research<\/[a-z]+>/i);
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
