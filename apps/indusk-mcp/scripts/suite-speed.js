/**
 * The everyday suite's speed, as a promise mark (test-kinds, ADR D7).
 *
 * `everyday-suite-stays-fast` is watched, never a gate: a run is marked held
 * or broken with how long it took, and a slow run fails nothing — it reads red
 * on the Promises page. A run that overlapped another test run (an
 * evaluator's, usually) is not judged: its duration says nothing about the
 * suite. With no telemetry daemon running, nothing is marked and the reason is
 * said.
 *
 * Plain JS, run by `with-daemon-guard.js`. The decision takes its inputs and
 * the sending takes its daemon and sender, so both are tested without a daemon
 * (lesson: code-that-decides-takes-its-clock-and-its-reads).
 */

import { execFileSync } from "node:child_process";

export const SUITE_PROMISE = "everyday-suite-stays-fast";
/** Twice the about-60 s target: loose enough for a busy machine. */
export const THRESHOLD_MS = 120_000;

/**
 * A run that failed under the threshold is not judged: a crash at startup —
 * a build error, a missing dependency — exits in seconds and would read as a
 * fast suite that never ran (test-kinds A23). A failed run over the threshold
 * is still broken: it was slow, whatever else it was.
 *
 * @param {{ durationMs: number, overlapped: boolean, exitCode?: number }} run
 * @returns {{ outcome: "upheld" | "violated", durationMs: number } | { skip: string }}
 */
export function suiteSpeedMark({ durationMs, overlapped, exitCode = 0 }) {
	if (overlapped) {
		return {
			skip: "another test run overlapped this one; its duration says nothing about the suite",
		};
	}
	if (durationMs >= THRESHOLD_MS) return { outcome: "violated", durationMs };
	if (exitCode !== 0) {
		return {
			skip: `the run failed (exit ${exitCode}) in ${Math.round(durationMs / 1000)} s; a failed run says nothing about how fast the suite is`,
		};
	}
	return { outcome: "upheld", durationMs };
}

/** The mark's span attributes, in the promise vocabulary every reader uses. */
export function suiteSpanAttributes(mark, project) {
	return {
		"indusk.promise": SUITE_PROMISE,
		"indusk.promise.outcome": mark.outcome,
		"indusk.suite.duration_ms": mark.durationMs,
		"indusk.project": project,
	};
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
 * Send `mark` to the local daemon. Returns what happened, in words, and never
 * throws: a mark that cannot be sent must not change the run's result.
 *
 * @param {string} root
 * @param {{ outcome: string, durationMs: number } | { skip: string }} mark
 * @param {{ status?: () => Promise<{ running: boolean, otlpPort?: number }>, send?: (intake: string, body: unknown) => Promise<void>, project?: (root: string) => string, body?: (name: string, attrs: object) => { body: unknown } }} [deps]
 */
export async function sendSuiteMark(root, mark, deps = {}) {
	if ("skip" in mark) return `not marked: ${mark.skip}`;
	try {
		const status = deps.status ?? (await import("../dist/lib/telemetry/status.js")).daemonStatus;
		const probe = deps.send && deps.body ? null : await import("../dist/lib/promises/probe.js");
		const project = deps.project ?? (await import("../dist/lib/promises/config.js")).markProjectId;
		const daemon = await status();
		if (!daemon.running) return "not marked: no telemetry daemon is running";
		const { body } = (deps.body ?? probe.watcherSpanBody)(
			"everyday-suite",
			suiteSpanAttributes(mark, project(root)),
		);
		await (deps.send ?? probe.sendWatcherSpan)(`http://localhost:${daemon.otlpPort}`, body);
		return `marked ${SUITE_PROMISE} ${mark.outcome} (${Math.round(mark.durationMs / 1000)} s)`;
	} catch (err) {
		return `not marked: ${err instanceof Error ? err.message : String(err)}`;
	}
}
