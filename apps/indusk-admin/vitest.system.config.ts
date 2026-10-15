import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { asGlob, SYSTEM, SYSTEM_TIER_ENV } from "./vitest.tiers";

// As in vitest.config.ts: no test auto-starts a telemetry daemon, and
// extension hooks run the CLI under test, not a global install.
process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART = "1";
process.env[SYSTEM_TIER_ENV] = "1";
// A contract that spawns `pnpm exec vitest … --reporter=json` (storybook A5)
// reads the child's stdout as JSON. Under `pnpm exec`, pnpm exports
// `verify_deps_before_run=false`, and a nested pnpm that sees it prints its
// "Unsupported platform" warnings to stdout, ahead of the report. Unset, the
// nested call is silent.
delete process.env.npm_config_verify_deps_before_run;
delete process.env.pnpm_config_verify_deps_before_run;
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
    include: SYSTEM.map(asGlob),
    exclude: [...configDefaults.exclude],
    environment: "node",
    fileParallelism: false,
    passWithNoTests: false,
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/system.junit.xml" },
  },
});
