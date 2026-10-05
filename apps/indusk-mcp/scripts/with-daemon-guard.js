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
 * `--mark <promise>` (the root `pnpm test` only): time the run and mark
 * `everyday-suite-stays-fast` held or broken in the local daemon
 * (`suite-speed.js`, test-kinds). The mark never changes the exit code.
 *
 * promise: everyday-suite-stays-fast
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { otherTestRunAlive, SUITE_PROMISE, sendSuiteMark, suiteSpeedMark } from "./suite-speed.js";

let argv = process.argv.slice(2);
let markPromise = null;
if (argv[0] === "--mark") {
	markPromise = argv[1];
	argv = argv.slice(2);
}
const [command, ...args] = argv;
if (!command || (markPromise !== null && markPromise !== SUITE_PROMISE)) {
	console.error(`usage: with-daemon-guard.js [--mark ${SUITE_PROMISE}] <command> [args…]`);
	process.exit(2);
}

const overlappedAtStart = markPromise ? await otherTestRunAlive() : false;
const started = Date.now();
const run = spawnSync(command, args, { stdio: "inherit" });
const runCode = run.status ?? 1;

if (markPromise) {
	const mark = suiteSpeedMark({
		durationMs: Date.now() - started,
		overlapped: overlappedAtStart || (await otherTestRunAlive(3_000)),
		exitCode: runCode,
	});
	const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
	console.error(`${SUITE_PROMISE}: ${await sendSuiteMark(root, mark)}`);
}

const guard = spawnSync(
	process.execPath,
	[join(dirname(fileURLToPath(import.meta.url)), "check-test-daemons.js")],
	{ stdio: "inherit" },
);
const guardCode = guard.status ?? 1;

process.exit(runCode !== 0 ? runCode : guardCode);
