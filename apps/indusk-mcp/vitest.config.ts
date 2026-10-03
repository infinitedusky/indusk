import { resolve } from "node:path";
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
process.env.INDUSK_BIN ??= `node ${resolve(__dirname, "dist/bin/cli.js")}`;

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
