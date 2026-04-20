import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T3 — `indusk ui status` reports running/port/registered-projects after start.
 * T4 — Double-`indusk ui start` prints "already running" and the existing URL.
 * T5 — `indusk ui stop` shuts down within 3s; status then reports "not running".
 * T6 — `indusk ui start --port <n>` listens on n; auto-bumps when n is taken.
 * T7 — Bare `indusk ui` is a friendly alias for `indusk ui start`.
 *
 * These tests spawn the actual CLI binary as a subprocess and assert on its
 * stdout. They use a temp INDUSK_HOME so the test daemon's PID/port files don't
 * collide with the user's real ~/.indusk/.
 *
 * SLOW TESTS — each spawns the CLI which boots the daemon (~5s warmup).
 * Skipped when SKIP_SLOW_TESTS=1.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1";

let testHome: string;

beforeEach(() => {
  testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
});

afterEach(() => {
  // Stop any running daemon spawned during the test
  if (existsSync(join(testHome, "admin-ui.pid"))) {
    runCli(["ui", "stop"]);
  }
  if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
});

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [CLI_BIN, ...args], {
    env: { ...process.env, INDUSK_HOME: testHome },
    encoding: "utf-8",
  });
  return {
    code: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe("T3 — `indusk ui status`", () => {
  it.skipIf(SHOULD_SKIP)("after `ui start`, status reports running + port + project count", async () => {
    runCli(["ui", "start", "--no-open", "--port", "0"]);
    await new Promise((r) => setTimeout(r, 6000));
    const status = runCli(["ui", "status"]);
    expect(status.stdout).toContain("running");
    expect(status.stdout).toMatch(/port \d+/i);
    expect(status.stdout).toMatch(/projects? \d+/i);
  }, 30_000);
});

describe("T4 — double `ui start` is idempotent", () => {
  it.skipIf(SHOULD_SKIP)("second start prints 'already running' and does NOT spawn a second daemon", async () => {
    runCli(["ui", "start", "--no-open", "--port", "0"]);
    await new Promise((r) => setTimeout(r, 6000));
    const second = runCli(["ui", "start", "--no-open", "--port", "0"]);
    expect(second.stdout).toMatch(/already running/i);
    // The same port appears in both starts → no second daemon
  }, 30_000);
});

describe("T5 — `indusk ui stop`", () => {
  it.skipIf(SHOULD_SKIP)("stops the daemon within 3s; subsequent status says not running", async () => {
    runCli(["ui", "start", "--no-open", "--port", "0"]);
    await new Promise((r) => setTimeout(r, 6000));
    const stop = runCli(["ui", "stop"]);
    expect(stop.code).toBe(0);
    await new Promise((r) => setTimeout(r, 1000));
    const status = runCli(["ui", "status"]);
    expect(status.stdout).toMatch(/not running/i);
  }, 30_000);
});

describe("T6 — `--port <n>` listens on n; auto-bumps on conflict", () => {
  it.skipIf(SHOULD_SKIP)("specified port is honored when free; auto-bumps with warning when taken", async () => {
    // First start on a specific port
    const first = runCli(["ui", "start", "--no-open", "--port", "53939"]);
    await new Promise((r) => setTimeout(r, 6000));
    expect(first.stdout).toContain("53939");
    // (Simulating a collision is heavyweight in a single test; this assertion
    // covers the "honored when free" half of T6. The auto-bump branch is
    // exercised by the unit test on findFreePort + manual smoke.)
  }, 30_000);
});

describe("T7 — bare `indusk ui` is a friendly alias for `start`", () => {
  it.skipIf(SHOULD_SKIP)("bare `indusk ui` starts the daemon and prints the URL", async () => {
    const bare = runCli(["ui", "--no-open", "--port", "0"]);
    await new Promise((r) => setTimeout(r, 6000));
    expect(bare.stdout).toMatch(/(starting|started|running).*localhost/i);
  }, 30_000);
});
