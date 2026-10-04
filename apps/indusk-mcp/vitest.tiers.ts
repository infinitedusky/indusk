/**
 * The two test tiers, one list (2026-10-02).
 *
 * `pnpm test` is the everyday suite: every file runs in parallel, nothing in
 * it starts a process that outlives a call. The SYSTEM tier is the files that
 * start a real outside system — the telemetry daemon, the always-on server,
 * the admin daemon, a packed tarball — and so prove the observer itself
 * works: a broken daemon makes the promise loop report nothing, which reads
 * as healthy. They are not stubbed (a stubbed Jaeger once passed while the
 * real one was broken); they run in `pnpm test:system`, which `pnpm release`
 * runs before it publishes.
 *
 * A file that starts such a system belongs in SYSTEM, or the everyday suite
 * is slow again and a port collision under parallel load reads as a flake.
 */
export const SYSTEM = [
	"src/__tests__/admin-bundle-pack.test.ts",
	"src/__tests__/admin-cli-lifecycle.test.ts",
	"src/__tests__/always-on-browser-login.test.ts",
	"src/__tests__/always-on-falsification.test.ts",
	"src/__tests__/always-on-health-tool.test.ts",
	"src/__tests__/always-on-image.test.ts",
	"src/__tests__/always-on-pass.test.ts",
	"src/__tests__/always-on-public-link.test.ts",
	"src/__tests__/always-on-server.test.ts",
	"src/__tests__/always-on-source.test.ts",
	"src/__tests__/always-on-two-servers.test.ts",
	"src/__tests__/cli-bare-ui-cwd-aware.test.ts",
	"src/__tests__/monitor-plans.test.ts",
	"src/__tests__/monitor-status.test.ts",
	"src/__tests__/monitor-watch.test.ts",
	"src/__tests__/telemetry-cli-lifecycle.test.ts",
	"src/__tests__/telemetry-existing-project-upgrade.test.ts",
	"src/__tests__/telemetry-explicit-disable.test.ts",
	"src/__tests__/telemetry-extension-disable.test.ts",
	"src/__tests__/telemetry-extension-enable.test.ts",
	"src/__tests__/telemetry-init-fresh.test.ts",
	"src/__tests__/telemetry-mcp-port-sync.test.ts",
	"src/__tests__/telemetry-restart-port-pin.test.ts",
	"src/__tests__/telemetry-ui-reachable.test.ts",
	"src/__tests__/test-daemons-guard.test.ts",
	"src/__tests__/update-scm-jj-removed.test.ts",
	"src/__tests__/watch-reopen-collision.test.ts",
	"src/__tests__/watcher-expect-every.test.ts",
	"src/__tests__/watcher-falsification.test.ts",
	"src/__tests__/watcher-heartbeat-server.test.ts",
	"src/__tests__/watcher-probe.test.ts",
];

/**
 * System files that must run alone, after the rest of the tier.
 * `admin-bundle-pack` runs `pnpm pack`, whose `prepublishOnly` rebuilds
 * `dist/` in place under every test spawning the CLI from it. The two
 * always-on files time the real server and a Slack capture end to end; under
 * a full parallel run they failed in two of five runs, and never alone.
 * `watcher-heartbeat-server` times the same server against a frozen Jaeger.
 * `always-on-image` builds a docker image, which would starve the timed files
 * beside it.
 *
 * Other files that start the always-on server run in parallel: every port a
 * server binds now comes from its settings (day-always-on-deploy A8), so the
 * gRPC clash on 16685 that sent them here is gone.
 */
export const RUN_ALONE = [
	"src/__tests__/admin-bundle-pack.test.ts",
	"src/__tests__/always-on-image.test.ts",
	"src/__tests__/always-on-pass.test.ts",
	"src/__tests__/always-on-source.test.ts",
	"src/__tests__/watcher-heartbeat-server.test.ts",
];
