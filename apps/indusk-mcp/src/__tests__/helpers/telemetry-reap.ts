import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

/**
 * Stop the telemetry daemon a temp-`INDUSK_HOME` CLI run caused to spawn.
 *
 * **Call this before removing the temp home, in every suite that runs the CLI
 * against one.** Running any CLI command with `INDUSK_HOME` pointed at a temp
 * directory auto-enables the `local-telemetry` extension, whose `on_enable`
 * hook starts a detached jaeger + otelcol pair. The PIDs are recorded only in
 * `$INDUSK_HOME/telemetry.json`, so deleting the home destroys the only record
 * of them — the pair survives, unreapable except by hand, holding ~17 MB each
 * and binding two ports.
 *
 * That is not hypothetical. On 2026-08-13 this had accumulated **2,058
 * orphaned processes holding 17.1 GB**, the oldest 16 days old, and they were
 * also racing the real daemon for ports — `POST :61419/v1/traces` was answering
 * 404 because a stray jaeger owned the port the dev stack was configured for.
 *
 * Best-effort by design: a suite must not fail because cleanup could not run.
 * The daemon is stopped through the CLI rather than by killing PIDs directly so
 * the registry files are cleaned up too.
 */
export function stopTelemetryForHome(testHome: string): void {
	if (!existsSync(CLI_BIN) || !existsSync(testHome)) return;
	spawnSync("node", [CLI_BIN, "telemetry", "stop"], {
		env: { ...process.env, INDUSK_HOME: testHome, INDUSK_SKIP_SELF_UPDATE: "1" },
		encoding: "utf-8",
	});
}

/**
 * The telemetry processes running from `home`, one `pid command` line each,
 * read from the process list — not from `telemetry.json`, which a deleted
 * home takes with it (test-daemons-never-leak).
 */
export function telemetryProcessesFor(home: string): string[] {
	const names = [home];
	try {
		names.push(realpathSync(home));
	} catch {
		// a home already removed still matches by the path it was started with
	}
	return execFileSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf-8" })
		.split("\n")
		.filter((l) => l.includes("telemetry-binari") && names.some((n) => l.includes(n)));
}
