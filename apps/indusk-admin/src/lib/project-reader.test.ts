import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_REFRESH_MS,
  hasEvalDirectory,
  MIN_REFRESH_MS,
  readAdminRefreshMs,
} from "./project-reader";

/**
 * admin-ui-phase-progress — A37 (cleanup).
 *
 * The project-level readers left the plan-folder reader, and the refresh
 * interval reads `.indusk/config.json` through the package's `readConfig`
 * rather than a second JSON parse of the file.
 */

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "project-reader-"));
  mkdirSync(join(root, ".indusk"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function config(body: string) {
  writeFileSync(join(root, ".indusk", "config.json"), body, "utf-8");
}

describe("A37 — readAdminRefreshMs through the package's config reader", () => {
  it("the ./config subpath resolves from the admin", async () => {
    const mod = await import("@infinitedusky/indusk-mcp/config");
    expect(typeof mod.readConfig).toBe("function");
  });

  it("a configured interval is honoured", () => {
    config(JSON.stringify({ admin: { refresh_ms: 2500 } }));
    expect(readAdminRefreshMs(root)).toBe(2500);
  });

  it("a malformed config.json yields the default, never a throw", () => {
    config("{ not json");
    expect(readAdminRefreshMs(root)).toBe(DEFAULT_REFRESH_MS);
  });

  it("no config, a non-number, and zero each fall back", () => {
    expect(readAdminRefreshMs(root)).toBe(DEFAULT_REFRESH_MS);
    config(JSON.stringify({ admin: { refresh_ms: "fast" } }));
    expect(readAdminRefreshMs(root)).toBe(DEFAULT_REFRESH_MS);
    config(JSON.stringify({ admin: { refresh_ms: 0 } }));
    expect(readAdminRefreshMs(root)).toBe(MIN_REFRESH_MS);
  });
});

describe("hasEvalDirectory", () => {
  it("is the presence of .indusk/eval/", () => {
    expect(hasEvalDirectory(root)).toBe(false);
    mkdirSync(join(root, ".indusk", "eval"));
    expect(hasEvalDirectory(root)).toBe(true);
  });
});
