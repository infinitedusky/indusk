import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
 * promise: every-component-state-has-a-story — A6.
 *
 * `Badge.tsx` marks `data-component="chip"` (the mockups' pill; their `badge` is
 * a plan's initials square, built in Build Phase 5), so A13 and A6 read the
 * catalog entry whose file is `Badge.tsx` and take its name from the catalog,
 * not from a hardcoded `badge`.
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const CLI = join(REPO, "apps/indusk-mcp/dist/bin/cli.js");

interface Catalog {
  components: Array<{
    name: string;
    file: string;
    properties: unknown[];
    states: Array<{ name: string; snapshotHash: string }>;
  }>;
}

/** The catalog entry for the component implemented in `Badge.tsx`, whatever its marker names it. */
function badgeEntry(catalog: Catalog) {
  return catalog.components.find((c) => /\/Badge\.tsx$/.test(c.file));
}

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

/** `indusk looks stories admin`, as a process, with no server running. */
function renderStories() {
  return spawnSync("node", [CLI, "looks", "stories", "admin"], {
    cwd: REPO,
    encoding: "utf-8",
    env: childEnv(),
    timeout: 280_000,
  });
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
  it("A13 the catalog lists the Badge.tsx component with its properties and each state that has a story, read with no server", () => {
    const run = renderStories();
    expect(
      run.status,
      `indusk looks stories admin must exit 0:\n${run.stdout}\n${run.stderr}`,
    ).toBe(0);

    const catalogFile = join(REPO, ".indusk/mockups/admin/components.json");
    expect(
      existsSync(catalogFile),
      `${catalogFile} is written by the build`,
    ).toBe(true);
    const catalog = JSON.parse(readFileSync(catalogFile, "utf-8")) as Catalog;
    const badge = badgeEntry(catalog);
    expect(
      badge,
      "the component implemented in Badge.tsx is in the catalog",
    ).toBeDefined();
    expect(badge?.file, "the catalog names the component's file").toMatch(
      /\/Badge\.tsx$/,
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
        `${badge?.name}.${state.name} has a snapshot hash`,
      ).toMatch(/^[0-9a-f]{64}$/);
      expect(
        existsSync(
          join(
            REPO,
            `.indusk/mockups/admin/components/${badge?.name}.${state.name}.html`,
          ),
        ),
        `${badge?.name}.${state.name}'s snapshot is written`,
      ).toBe(true);
    }
  }, 300_000);

  // A6
  it("A6 a changed component changes its snapshot with no edit to the story", () => {
    const render = renderStories;
    const component = join(
      REPO,
      "apps/indusk-admin/src/components/ui/Badge.tsx",
    );
    const catalogFile = join(REPO, ".indusk/mockups/admin/components.json");
    const snapshotOf = () => {
      const entry = badgeEntry(
        JSON.parse(readFileSync(catalogFile, "utf-8")) as Catalog,
      );
      const state = entry?.states[0]?.name;
      return readFileSync(
        join(
          REPO,
          `.indusk/mockups/admin/components/${entry?.name}.${state}.html`,
        ),
        "utf-8",
      );
    };
    const original = readFileSync(component, "utf-8");
    const first = render();
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    const before = snapshotOf();
    try {
      writeFileSync(component, original.replace("px-2 py-1", "px-3 py-1"));
      const second = render();
      expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);
      expect(snapshotOf()).not.toBe(before);
    } finally {
      writeFileSync(component, original);
      render();
    }
    // The stories file was not edited: only the component changed, and it is restored.
    expect(
      spawnSync(
        "git",
        ["status", "--porcelain", "--", "apps/indusk-admin/src"],
        {
          cwd: REPO,
          encoding: "utf-8",
        },
      ).stdout,
    ).not.toMatch(/stories/);
  }, 300_000);
});
