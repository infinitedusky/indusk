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
 *
 * `--record-duration` (the root `pnpm test` only): time the run and append it
 * to the project's duration record (`suite-speed.js`, tests-never-make-us-wait).
 * It marks no promise and never changes the exit code.
 *
 * promise: everyday-suite-stays-fast — kept in the registry only until
 * tests-never-make-us-wait closes and `promises confirm` retires it for
 * `a-plan-runs-its-tests-and-what-must-not-break`; nothing marks it any more.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { otherTestRunAlive, recordSuiteDuration, suiteDurationRecord } from "./suite-speed.js";

let argv = process.argv.slice(2);
let recordDuration = false;
if (argv[0] === "--record-duration") {
	recordDuration = true;
	argv = argv.slice(1);
}
const [command, ...args] = argv;
if (!command) {
	console.error("usage: with-daemon-guard.js [--record-duration] <command> [args…]");
	process.exit(2);
}

const overlappedAtStart = recordDuration ? await otherTestRunAlive() : false;
const started = Date.now();
const run = spawnSync(command, args, { stdio: "inherit" });
const runCode = run.status ?? 1;

if (recordDuration) {
	const record = suiteDurationRecord({
		durationMs: Date.now() - started,
		overlapped: overlappedAtStart || (await otherTestRunAlive(3_000)),
		exitCode: runCode,
		at: new Date().toISOString(),
	});
	const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
	console.error(`everyday suite: ${await recordSuiteDuration(root, record)}`);
}

const guard = spawnSync(
	process.execPath,
	[join(dirname(fileURLToPath(import.meta.url)), "check-test-daemons.js")],
	{ stdio: "inherit" },
);
const guardCode = guard.status ?? 1;

process.exit(runCode !== 0 ? runCode : guardCode);
