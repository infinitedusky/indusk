import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";

/**
 * One `next dev` boot for every HTTP-level test (admin-ui-phase-progress,
 * Test Phase 2). Four smokes each carried the same forty lines — free port,
 * spawn, wait for "✓ Ready", kill on teardown — and the live-refresh rows
 * needed a fifth copy plus a browser on top. The registry is the caller's:
 * it decides which projects the daemon sees.
 *
 * Only one `next dev` can run against this app directory at a time (Next
 * holds a lock on `.next/`), which is why the node project runs these files
 * serially (`fileParallelism: false`).
 */

export const ADMIN_ROOT = path.resolve(__dirname, "../../..");

export interface RegistryProject {
  name: string;
  path: string;
}

export interface DevServer {
  url: string;
  port: number;
  /** SIGTERM, then SIGKILL after a beat. Safe to call twice. */
  stop: () => Promise<void>;
}

/** A fresh `INDUSK_HOME` with the given registry entries. */
export function makeHome(projects: RegistryProject[]): string {
  const home = mkdtempSync(path.join(tmpdir(), "indusk-home-"));
  writeRegistry(home, projects);
  return home;
}

export function writeRegistry(home: string, projects: RegistryProject[]): void {
  const now = new Date().toISOString();
  writeFileSync(
    path.join(home, "projects.json"),
    JSON.stringify({
      version: 1,
      projects: projects.map((p) => ({
        name: p.name,
        path: p.path,
        registeredAt: now,
        lastSeenAt: now,
      })),
    }),
  );
}

/** Boot `next dev` on a free port with `INDUSK_HOME` pointed at `home`. */
export async function startNextDev(options: {
  home: string;
  env?: NodeJS.ProcessEnv;
}): Promise<DevServer> {
  const port = await findFreePort();
  const server: ChildProcess = spawn(
    "pnpm",
    ["exec", "next", "dev", "--port", String(port)],
    {
      cwd: ADMIN_ROOT,
      env: { ...process.env, INDUSK_HOME: options.home, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise<void>((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new Error("next dev did not become ready in 30s")),
      30_000,
    );
    server.stdout?.on("data", (chunk) => {
      if (/✓ Ready in/.test(chunk.toString())) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
    server.on("error", rejectReady);
  });
  // A beat so the first request does not race the listener bind.
  await sleep(500);

  let stopped = false;
  return {
    url: `http://localhost:${port}`,
    port,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      if (!server.killed) {
        server.kill("SIGTERM");
        await sleep(200);
        if (!server.killed) server.kill("SIGKILL");
      }
    },
  };
}

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

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
