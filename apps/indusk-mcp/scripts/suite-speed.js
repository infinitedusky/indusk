/**
 * The everyday suite's duration, recorded (tests-never-make-us-wait).
 *
 * Each run of the root `pnpm test` appends one line to
 * `suite-durations.jsonl` in the project's machine-state home
 * (`indusk eval home`): when it ended, how long it took, whether it passed and
 * whether it overlapped another test run (an evaluator's, usually, which says
 * nothing about the suite). It marks no promise; the brief's expectation
 * ("the suite under a minute") is met by degree and read from this record.
 * A record that cannot be written is said and never changes the run's result.
 *
 * Plain JS, run by `with-daemon-guard.js`. The record takes its clock and its
 * folder as inputs, so it is tested without either
 * (lesson: code-that-decides-takes-its-clock-and-its-reads).
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** The file, inside the project's machine-state home, one JSON line per run. */
export const DURATION_FILE = "suite-durations.jsonl";

/**
 * One run as a line of the record.
 *
 * @param {{ durationMs: number, overlapped: boolean, exitCode?: number, at: string }} run
 */
export function suiteDurationRecord({ durationMs, overlapped, exitCode = 0, at }) {
	return { at, durationMs: Math.round(durationMs), passed: exitCode === 0, overlapped };
}

/**
 * Test runs among `processes` that are not this run: a vitest binary or
 * worker (its path, not the word — a shell running `pgrep -f vitest` names
 * the word), and not one of `self`'s ancestors.
 *
 * @param {Array<{ pid: number, ppid: number, command: string }>} processes
 * @param {number} self
 */
export function otherTestRuns(processes, self) {
	const parent = new Map(processes.map((p) => [p.pid, p.ppid]));
	const ancestors = new Set();
	for (let pid = self; pid && !ancestors.has(pid); pid = parent.get(pid)) ancestors.add(pid);
	return processes.filter((p) => /\/vitest(?:\.mjs\b|\/)/.test(p.command) && !ancestors.has(p.pid));
}

function processTable() {
	try {
		return execFileSync("ps", ["-Ao", "pid=,ppid=,command="], { encoding: "utf-8" })
			.split("\n")
			.map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
			.filter(Boolean)
			.map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3] }));
	} catch {
		return [];
	}
}

/**
 * True when another test run is alive. At the end of a run, its own workers
 * can take a moment to exit: `settleMs` lets them before deciding.
 */
export async function otherTestRunAlive(settleMs = 0) {
	const deadline = Date.now() + settleMs;
	for (;;) {
		if (otherTestRuns(processTable(), process.pid).length === 0) return false;
		if (Date.now() >= deadline) return true;
		await new Promise((r) => setTimeout(r, 250));
	}
}

/**
 * Append `record` to the project's duration record. Returns what happened, in
 * words, and never throws: a record that cannot be written must not change the
 * run's result.
 *
 * @param {string} root the main checkout
 * @param {ReturnType<typeof suiteDurationRecord>} record
 * @param {{ home?: (root: string) => Promise<string> | string }} [deps]
 */
export async function recordSuiteDuration(root, record, deps = {}) {
	try {
		const home =
			(await deps.home?.(root)) ??
			(await import("../dist/lib/bookkeeping/roots.js")).bookkeepingRoots(root).home;
		mkdirSync(home, { recursive: true });
		appendFileSync(join(home, DURATION_FILE), `${JSON.stringify(record)}\n`);
		return `recorded ${Math.round(record.durationMs / 1000)} s${record.overlapped ? " (overlapped another test run)" : ""}`;
	} catch (err) {
		return `not recorded: ${err instanceof Error ? err.message : String(err)}`;
	}
}
