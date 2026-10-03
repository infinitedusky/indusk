#!/usr/bin/env node
/**
 * with-daemon-guard.js <command> [args…] — run a test command, then always run
 * the leaked-daemon guard (`check-test-daemons.js`), pass or fail.
 *
 * The guard was first chained with `&&`, which skipped it on exactly the runs
 * most likely to leak — a crash, a timeout, a test that died before its
 * cleanup (test-daemons-never-leak, falsification A4). Here it runs after
 * every run, and the exit code is the command's own failure first, then the
 * guard's: a failing suite still reads as a failing suite, and a passing one
 * that leaked a daemon fails.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [command, ...args] = process.argv.slice(2);
if (!command) {
	console.error("usage: with-daemon-guard.js <command> [args…]");
	process.exit(2);
}

const run = spawnSync(command, args, { stdio: "inherit" });
const runCode = run.status ?? 1;

const guard = spawnSync(
	process.execPath,
	[join(dirname(fileURLToPath(import.meta.url)), "check-test-daemons.js")],
	{ stdio: "inherit" },
);
const guardCode = guard.status ?? 1;

process.exit(runCode !== 0 ? runCode : guardCode);
