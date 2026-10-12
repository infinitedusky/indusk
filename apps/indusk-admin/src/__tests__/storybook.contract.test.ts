import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * storybook-components A5 and A13 — a contract with Storybook, Vitest and
 * Chromium, so the system tier (`vitest.tiers.ts` `SYSTEM`; lesson:
 * everyday-tests-never-wait). Each reaches its subject as a process that runs
 * and exits, so each is red today on its own assertion: the admin has no
 * `storybook` vitest project and `indusk` has no `looks stories` command.
 *
 * promise: every-component-state-has-a-story — A5.
 * promise: an-agent-can-find-every-component — A13.
 *
 * A6 (a changed component changes its snapshot, with no edit to the story)
 * joins this file in Build Phase 2, in the register of impl.md's Test Phase 1.
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const CLI = join(REPO, "apps/indusk-mcp/dist/bin/cli.js");

/** The environment of a child that must not believe it is inside this test run. */
function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    INDUSK_SKIP_UPDATE_CHECK: "1",
  };
  for (const key of Object.keys(env))
    if (key.startsWith("VITEST")) delete env[key];
  return env;
}

describe("Storybook in the admin", () => {
  // A5
  it("A5 every story renders its component in a real browser without an error", () => {
    const run = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "--project", "storybook", "--reporter=json"],
      { cwd: ADMIN, encoding: "utf-8", env: childEnv(), timeout: 280_000 },
    );
    const json = run.stdout.slice(run.stdout.indexOf("{"));
    let report: { numPassedTests?: number; numFailedTests?: number } = {};
    try {
      report = JSON.parse(json);
    } catch {
      // No report at all: the project does not exist, and the exit code says so.
    }
    expect(
      run.status,
      `the storybook project must run and pass:\n${run.stderr.slice(-800)}`,
    ).toBe(0);
    expect(report.numFailedTests ?? 0, "no story fails").toBe(0);
    expect(
      report.numPassedTests ?? 0,
      "at least one story ran",
    ).toBeGreaterThan(0);
  }, 300_000);

  // A13
  it("A13 the catalog lists badge with its properties and each state that has a story, read with no server", () => {
    const run = spawnSync("node", [CLI, "looks", "stories", "admin"], {
      cwd: REPO,
      encoding: "utf-8",
      env: childEnv(),
      timeout: 280_000,
    });
    expect(
      run.status,
      `indusk looks stories admin must exit 0:\n${run.stdout}\n${run.stderr}`,
    ).toBe(0);

    const catalogFile = join(REPO, ".indusk/mockups/admin/components.json");
    expect(
      existsSync(catalogFile),
      `${catalogFile} is written by the build`,
    ).toBe(true);
    const catalog = JSON.parse(readFileSync(catalogFile, "utf-8")) as {
      components: Array<{
        name: string;
        file: string;
        properties: unknown[];
        states: Array<{ name: string; snapshotHash: string }>;
      }>;
    };
    const badge = catalog.components.find((c) => c.name === "badge");
    expect(badge, "badge is in the catalog").toBeDefined();
    expect(badge?.file, "the catalog names the component's file").toMatch(
      /Badge\.tsx$/,
    );
    expect(
      badge?.properties.length,
      "badge's properties are listed",
    ).toBeGreaterThan(0);
    expect(
      badge?.states.length,
      "badge's states with a story are listed",
    ).toBeGreaterThan(0);
    for (const state of badge?.states ?? []) {
      expect(
        state.snapshotHash,
        `badge.${state.name} has a snapshot hash`,
      ).toMatch(/^[0-9a-f]{64}$/);
      expect(
        existsSync(
          join(
            REPO,
            `.indusk/mockups/admin/components/badge.${state.name}.html`,
          ),
        ),
        `badge.${state.name}'s snapshot is written`,
      ).toBe(true);
    }
  }, 300_000);
});
