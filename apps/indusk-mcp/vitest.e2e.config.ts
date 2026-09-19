import { defineConfig } from "vitest/config";

/**
 * End-to-end tests (day-monitor): the whole loop on a developer machine, with
 * the real `claude` CLI and the local-telemetry extension's daemon. Run with
 * `pnpm e2e`; the default config excludes `e2e/`, so `pnpm test` never runs
 * them. They are slow and need things a CI box may not have — which is why
 * they are their own project rather than skipped cases inside the suite.
 */
export default defineConfig({
	test: {
		include: ["e2e/**/*.e2e.test.ts"],
		testTimeout: 180_000,
		hookTimeout: 120_000,
		fileParallelism: false,
	},
});
