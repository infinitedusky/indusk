import { configDefaults, defineConfig } from "vitest/config";

/**
 * Files that must run alone, after everything else. `admin-bundle-pack` runs
 * `pnpm pack`, whose `prepublishOnly` rebuilds `dist/` in place — every other
 * test that spawns the CLI from `dist/` would race it.
 *
 * The rest run in parallel. The blanket `fileParallelism: false` this replaces
 * (2026-04, local-telemetry) serialized all ~275 files for the few that start
 * the telemetry daemon; those now take free ports (`findFreePort`) under a
 * per-test `INDUSK_HOME`, so they no longer share anything a second file can
 * collide with. A file that does belongs here, with the reason beside it.
 * Measured 2026-10-02: ~490 s all serial → ~95 s (parallel, then this group).
 */
const SERIAL = [
	"src/__tests__/admin-bundle-pack.test.ts",
	// The always-on server binary plus a Slack capture, timed end to end: under
	// a full parallel run these failed in two of five runs (2026-10-02), and
	// never alone.
	"src/__tests__/always-on-pass.test.ts",
	"src/__tests__/always-on-source.test.ts",
];

export default defineConfig({
	test: {
		// End-to-end tests need the real `claude` CLI and a telemetry daemon;
		// they run with `pnpm e2e` (vitest.e2e.config.ts), never in `pnpm test`.
		exclude: [...configDefaults.exclude, "e2e/**"],
		passWithNoTests: true,
		projects: [
			{
				extends: true,
				test: {
					name: "indusk-mcp",
					include: ["**/*.test.ts"],
					exclude: [...configDefaults.exclude, "e2e/**", ...SERIAL],
					sequence: { groupOrder: 0 },
				},
			},
			{
				extends: true,
				test: {
					name: "indusk-mcp:serial",
					include: SERIAL,
					fileParallelism: false,
					// Its own group, after the parallel one: never alongside a test
					// reading `dist/`.
					sequence: { groupOrder: 1 },
				},
			},
		],
	},
});
