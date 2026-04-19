import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

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
          include: [
            "src/lib/**/*.test.ts",
            "src/__tests__/**/*.test.ts",
          ],
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
