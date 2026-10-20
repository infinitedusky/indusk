import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import { asGlob, NODE_PAGES, SYSTEM, SYSTEM_TIER_ENV } from "./vitest.tiers";

// Tests never auto-start a telemetry daemon (test-daemons-never-leak): any
// test that runs `init` or `update` against a temporary home made `telemetry
// register` start a detached Jaeger + otelcol pair nothing stopped — 860 found
// running on 2026-10-03. Set on process.env as the config loads, so every
// worker and every child process a test spawns inherits it. The system tier
// (vitest.system.config.ts) does not load this file: its tests start real
// daemons on purpose, and `telemetry-init-fresh` asserts that init does.
process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART = "1";
// Extension hooks run `indusk …`; without this they run whatever version is
// installed globally, not the code under test — which is also why the switch
// above did nothing until it was here (test-daemons-never-leak).
process.env.INDUSK_BIN ??= `node ${path.resolve(__dirname, "../indusk-mcp/dist/bin/cli.js")}`;

// A run's record is machine state in the InDusk home (a-run-can-be-trusted): a test that starts
// a run through the build host writes one, and it must not land in the person's real home.
process.env.INDUSK_HOME ??= mkdtempSync(
  path.join(tmpdir(), "indusk-admin-test-home-"),
);

/** The `@/` alias every project shares. */
const resolve = { alias: { "@": path.resolve(__dirname, "src") } };

/**
 * The `storybook` project: every story rendered in Chromium (storybook-
 * components A5). It is the system tier's (`SYSTEM_PROJECTS`), so `pnpm test`
 * does not define it; a run the system tier started (`vitest.system.config.ts`
 * raises the variable, and A5's child inherits it) does.
 */
const storybookProjects = process.env[SYSTEM_TIER_ENV]
  ? [
      {
        resolve,
        plugins: [
          storybookTest({
            configDir: path.resolve(__dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" as const }],
          },
        },
      },
    ]
  : [];

/**
 * Two test environments:
 *   - **node**: server-side `src/lib/*` tests (filesystem, parsers, planning-reader).
 *     Real Node, no DOM, no browser overhead. Fast.
 *   - **browser**: React component tests under `src/**` (excluding `src/lib/`).
 *     Real Chromium via @vitest/browser-playwright. Catches CSS/layout/color
 *     rendering that jsdom misses — critical for A9's visual color-coding test
 *     and v1's broader visual-discipline goal.
 *
 * Both projects share the `@/` alias and `passWithNoTests: true`.
 */
export default defineConfig({
  resolve,
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve,
        test: {
          name: "node",
          // Node-only tests: lib parsers + audit scripts that touch the filesystem
          // and don't render React. Audit lives at top-level src/__tests__/.
          include: [
            "src/lib/**/*.test.ts",
            "src/__tests__/**/*.test.ts",
            ...NODE_PAGES.map(asGlob),
          ],
          // Files that start `next dev` or a Jaeger are the system tier
          // (vitest.tiers.ts, `pnpm test:system`); with them gone, nothing
          // here boots a server, so the files run in parallel (test-kinds).
          exclude: [...configDefaults.exclude, ...SYSTEM.map(asGlob)],
          environment: "node",
        },
      },
      {
        resolve,
        test: {
          name: "browser",
          // Browser tests: React component tests under src/. Excludes lib (node)
          // and src/__tests__/ (node-only audits).
          include: ["src/**/*.test.{ts,tsx}"],
          // A system-tier file or a node page test under src/app/ is not a
          // browser test either (ui-promises Build Phase 4).
          exclude: [
            "src/lib/**",
            "src/__tests__/**",
            ...SYSTEM.map(asGlob),
            ...NODE_PAGES.map(asGlob),
          ],
          // A page's reads and kept standings load node-only readers; mocked once here.
          setupFiles: ["src/__tests__/helpers/browser-page-reads.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      ...storybookProjects,
    ],
  },
});
