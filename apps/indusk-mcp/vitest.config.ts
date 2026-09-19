import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	extends: true,
	test: {
		include: ["**/*.test.ts"],
		// End-to-end tests need the real `claude` CLI and a telemetry daemon;
		// they run with `pnpm e2e` (vitest.e2e.config.ts), never in `pnpm test`.
		exclude: [...configDefaults.exclude, "e2e/**"],
		passWithNoTests: true,
		// Several tests spawn the telemetry daemon (Jaeger + otelcol). Running
		// those files in parallel causes port allocation contention + Jaeger
		// health-probe timeouts under ~15s. Serialize file-level execution so
		// each daemon spawn sees a clean machine. Mirrors the admin-UI Phase 7
		// lesson carried forward into 1.28.
		fileParallelism: false,
	},
});
