import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { SYSTEM } from "./vitest.tiers";

// As in vitest.config.ts: no test auto-starts a telemetry daemon, and
// extension hooks run the CLI under test, not a global install.
process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART = "1";
process.env.INDUSK_BIN ??= `node ${path.resolve(__dirname, "../indusk-mcp/dist/bin/cli.js")}`;

/**
 * The admin's system tier (`pnpm test:system`): every file that starts `next
 * dev` or a real Jaeger, one file at a time — `next dev` boots in parallel
 * starve each other past their ready timeout. Runs at landing and on release
 * (test-kinds, ADR D4/D5).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    name: "system",
    include: SYSTEM,
    exclude: [...configDefaults.exclude],
    environment: "node",
    fileParallelism: false,
    passWithNoTests: false,
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/system.junit.xml" },
  },
});
