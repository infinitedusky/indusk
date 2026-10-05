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
 * @param {{ durationMs: number, overlapped: boolean }} run
 * @returns {{ outcome: "upheld" | "violated", durationMs: number } | { skip: string }}
 */
export function suiteSpeedMark({ durationMs, overlapped }) {
	if (overlapped) {
		return {
			skip: "another test run overlapped this one; its duration says nothing about the suite",
		};
	}
	return { outcome: durationMs >= THRESHOLD_MS ? "violated" : "upheld", durationMs };
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

/** True when a `vitest` process other than our own descendants is alive now. */
export function otherTestRunAlive() {
	try {
		return execFileSync("pgrep", ["-f", "vitest"], { encoding: "utf-8" }).trim().length > 0;
	} catch {
		return false; // pgrep exits 1 when nothing matches
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
