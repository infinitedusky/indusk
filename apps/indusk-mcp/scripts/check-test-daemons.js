#!/usr/bin/env node
/**
 * check-test-daemons.js — the root `pnpm test` ends here: fail on any
 * telemetry daemon left running from a temporary home.
 *
 * Tests run the CLI against temporary `INDUSK_HOME`s. A daemon started from
 * one and never stopped survives the test, and its only record lives in a home
 * the test deletes — 2,058 such processes on 2026-08-13 and 860 on
 * 2026-10-03, each found by accident. The everyday suites no longer start
 * them (test-daemons-never-leak); this makes the next leak a red run that
 * names it, rather than a machine slowly filling up.
 *
 * Reads the process list, not records: a telemetry binary whose `--config`
 * lives under a temporary directory is a test's. The real daemon's config
 * lives under `~/.indusk` and is never named.
 */

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";

const tempRoots = [...new Set(["/tmp", "/private/tmp", tmpdir(), safeRealpath(tmpdir())])].filter(
	Boolean,
);

function safeRealpath(p) {
	try {
		return realpathSync(p);
	} catch {
		return null;
	}
}

/** The directory a telemetry binary's `--config` names, or null. */
function configDir(command) {
	const m = /--config[= ](?:file:)?(\S+)/.exec(command);
	if (!m) return null;
	return m[1].slice(0, m[1].lastIndexOf("/"));
}

const leaked = execFileSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf-8" })
	.split("\n")
	.map((l) => l.trim())
	.filter((l) => l.includes("telemetry-binari"))
	.map((l) => {
		const pid = l.slice(0, l.indexOf(" "));
		const binary = /\/bin\/(jaeger|otelcol)\b/.exec(l)?.[1] ?? "telemetry";
		return { pid, binary, home: configDir(l) };
	})
	.filter((p) => p.home && tempRoots.some((root) => p.home.startsWith(`${root}/`)));

if (leaked.length === 0) {
	console.info("check-test-daemons: no telemetry daemon left running from a temporary home.");
	process.exit(0);
}

console.error(
	`check-test-daemons: ${leaked.length} telemetry process(es) left running from temporary homes — a test started a daemon and did not stop it:`,
);
for (const p of leaked) console.error(`  pid ${p.pid}  ${p.binary}  ${p.home}`);
console.error(
	"Stop them (`kill <pid>…`) and find the test: it runs the CLI against a temp home with INDUSK_SKIP_TELEMETRY_AUTOSTART unset, or starts a daemon itself without stopping it.",
);
process.exit(1);
