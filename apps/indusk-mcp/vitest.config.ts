import { configDefaults, defineConfig } from "vitest/config";
import { SYSTEM } from "./vitest.tiers";

/**
 * The everyday suite: every file in parallel. The blanket
 * `fileParallelism: false` this replaces (2026-04, local-telemetry)
 * serialized ~275 files for the few that start the telemetry daemon; those
 * are the SYSTEM tier now (`vitest.tiers.ts`, `pnpm test:system`).
 * Measured 2026-10-02: ~490 s all serial → ~60 s (the slowest single file,
 * `run/workbench-split`, is now the floor); the system tier is ~85 s.
 */
export default defineConfig({
	extends: true,
	test: {
		include: ["**/*.test.ts"],
		// End-to-end tests need the real `claude` CLI and a telemetry daemon;
		// they run with `pnpm e2e` (vitest.e2e.config.ts), never in `pnpm test`.
		exclude: [...configDefaults.exclude, "e2e/**", ...SYSTEM],
		passWithNoTests: true,
	},
});
