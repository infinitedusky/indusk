import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface UiOptions {
  port: string;
  open: boolean;
}

/**
 * Spawn the indusk-admin Next.js dev server in the user's project root.
 *
 * - Runs `pnpm exec next dev` from `apps/indusk-admin/` so admin-ui's deps
 *   resolve correctly via the workspace.
 * - Sets `INDUSK_PROJECT_ROOT` to the project root so the admin app's
 *   server components read the right `.indusk/planning/` regardless of
 *   `process.cwd()` inside the spawned process. (For now, admin-ui reads
 *   from `process.cwd()` directly — child process inherits cwd from the
 *   indusk CLI's invocation.)
 * - Auto-bumps the port if the requested one is taken.
 * - Optionally opens the browser when stdout reports "ready".
 *
 * v1 ships the source tree (admin-ui as a workspace app, dev mode). v2 may
 * switch to a built static export if startup latency or package size become
 * pain points.
 */
export async function ui(projectRoot: string, opts: UiOptions): Promise<void> {
  const requestedPort = Number.parseInt(opts.port, 10);
  if (!Number.isFinite(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    console.error(`Invalid --port value: ${opts.port}`);
    process.exit(1);
  }

  const adminDir = resolveAdminDir();
  if (!existsSync(adminDir)) {
    console.error(
      `indusk-admin app not found at ${adminDir}. ` +
        "If running from a published package, ensure indusk-admin is bundled.",
    );
    process.exit(1);
  }

  const port = requestedPort === 0 ? await findFreePort() : await ensureFreePort(requestedPort);
  if (port !== requestedPort && requestedPort !== 0) {
    console.warn(`Port ${requestedPort} is in use; using ${port} instead.`);
  }

  console.info(`Starting indusk-admin on http://localhost:${port}/`);
  console.info(`Project root: ${projectRoot}`);

  const child = spawn("pnpm", ["exec", "next", "dev", "--port", String(port)], {
    cwd: adminDir,
    env: {
      ...process.env,
      INDUSK_PROJECT_ROOT: projectRoot,
    },
    stdio: ["inherit", "pipe", "inherit"],
  });

  let opened = false;
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!opened && opts.open && /\bReady\b|\bready in\b|started server/i.test(text)) {
      opened = true;
      openBrowser(`http://localhost:${port}/`);
    }
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

/**
 * Resolve the admin app directory. In the source repo, that's the sibling
 * `apps/indusk-admin/`. When indusk-mcp is npm-installed, this needs to
 * resolve to the bundled path (decided in Phase 6 — for now only the source
 * layout is supported).
 */
function resolveAdminDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // here = apps/indusk-mcp/dist/bin/commands/  (or .../src/bin/commands/ in dev)
  // Walk up to apps/, then into indusk-admin
  const candidates = [
    resolve(here, "../../../../indusk-admin"),
    resolve(here, "../../../indusk-admin"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "package.json"))) return c;
  }
  return candidates[0];
}

async function ensureFreePort(port: number): Promise<number> {
  if (await isPortFree(port)) return port;
  return findFreePort();
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolveProm) => {
    const server = createServer();
    server.once("error", () => resolveProm(false));
    server.once("listening", () => {
      server.close(() => resolveProm(true));
    });
    server.listen(port);
  });
}

function findFreePort(): Promise<number> {
  return new Promise((resolveProm, rejectProm) => {
    const server = createServer();
    server.once("error", rejectProm);
    server.listen(0, () => {
      const addr = server.address();
      if (typeof addr === "object" && addr !== null) {
        const port = addr.port;
        server.close(() => resolveProm(port));
      } else {
        rejectProm(new Error("Could not determine free port"));
      }
    });
  });
}

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}
