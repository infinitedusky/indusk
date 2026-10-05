import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import { SYSTEM } from "./vitest.tiers";

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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
        test: {
          name: "node",
          // Node-only tests: lib parsers + audit scripts that touch the filesystem
          // and don't render React. Audit lives at top-level src/__tests__/.
          include: ["src/lib/**/*.test.ts", "src/__tests__/**/*.test.ts"],
          // Files that start `next dev` or a Jaeger are the system tier
          // (vitest.tiers.ts, `pnpm test:system`); with them gone, nothing
          // here boots a server, so the files run in parallel (test-kinds).
          exclude: [...configDefaults.exclude, ...SYSTEM],
          environment: "node",
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
        test: {
          name: "browser",
          // Browser tests: React component tests under src/. Excludes lib (node)
          // and src/__tests__/ (node-only audits).
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/lib/**", "src/__tests__/**"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
