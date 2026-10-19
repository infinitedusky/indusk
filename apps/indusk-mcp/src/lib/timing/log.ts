import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { bookkeepingRoots } from "../bookkeeping/roots.js";

/**
 * The per-plan timing log (plan-timing ADR): one append-only JSONL file per plan
 * in the project's machine-state home, the same home `indusk eval home` prints.
 * Phase closes, unattended steps and test runs all go here; `plans time` reads it.
 *
 * Writes go through `recordSafely` (`safe.ts`) so a record that cannot be
 * written never stops the work it records. The reader is the other half of that
 * rule: it skips anything it cannot read and never throws.
 *
 * promise: a-plan-says-how-long-it-took
 */

export type StepOutcome = "finished" | "blocked" | "failed" | "stopped";

/** What a recorder supplies; the log adds the version and the time. */
export type TimingEntry =
	| { kind: "phase-close"; plan: string; phase: number; phaseKind?: "test" | "build"; sha: string }
	| { kind: "step-start"; plan: string; id: string; step: string; phase?: string }
	| {
			kind: "step-end";
			plan: string;
			id: string;
			step: string;
			phase?: string;
			outcome: StepOutcome;
	  }
	| {
			kind: "test-run";
			plan: string;
			scope: { phase: string } | "landing";
			files: { own: number; reached: number; mustNotBreak: number };
			startedAt: string;
			durationMs: number;
			passed: boolean;
	  };

export type TimingRecord = TimingEntry & { v: 1; at: string };

const KINDS: readonly string[] = ["phase-close", "step-start", "step-end", "test-run"];

/** Where a plan's log lives: `<home>/timing/<plan>.jsonl`. */
export function timingLogPath(anyCheckout: string, plan: string, home?: string): string {
	return join(bookkeepingRoots(anyCheckout, home).home, "timing", `${plan}.jsonl`);
}

/** Append one line, stamped with the version and the time from the injected clock. */
export async function appendTiming(
	path: string,
	entry: TimingEntry,
	now: () => number = Date.now,
): Promise<void> {
	const record: TimingRecord = { v: 1, ...entry, at: new Date(now()).toISOString() };
	// `v`, `kind`, `plan`, `at` first reads best in the file; key order is not load-bearing.
	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}

const OUTCOMES: readonly string[] = ["finished", "blocked", "failed", "stopped"];

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isTime = (v: unknown): boolean => isStr(v) && Number.isFinite(Date.parse(v));

function hasFieldsOfKind(r: Record<string, unknown>): boolean {
	switch (r.kind) {
		case "phase-close":
			return isNum(r.phase);
		case "step-start":
			return isStr(r.id) && isStr(r.step);
		case "step-end":
			return isStr(r.id) && isStr(r.step) && isStr(r.outcome) && OUTCOMES.includes(r.outcome);
		case "test-run": {
			const scope = r.scope as { phase?: unknown } | string | null | undefined;
			const files = r.files as Record<string, unknown> | null | undefined;
			return (
				(scope === "landing" ||
					(typeof scope === "object" && scope !== null && isStr(scope.phase))) &&
				typeof files === "object" &&
				files !== null &&
				isNum(files.own) &&
				isNum(files.reached) &&
				isNum(files.mustNotBreak) &&
				isNum(r.durationMs) &&
				isTime(r.startedAt) &&
				typeof r.passed === "boolean"
			);
		}
		default:
			return false;
	}
}

/** A record the view can read without a throw or a NaN: its version, kind, plan, time and the fields its kind needs. */
function isTimingRecord(value: unknown): value is TimingRecord {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const r = value as Record<string, unknown>;
	return (
		r.v === 1 &&
		isStr(r.kind) &&
		KINDS.includes(r.kind) &&
		isStr(r.plan) &&
		isTime(r.at) &&
		hasFieldsOfKind(r)
	);
}

/**
 * Every line that parses and is a version-1 record of a known kind, in file
 * order. A missing file, a corrupt line, a half-written last line and a record
 * of another version are skipped, never thrown: an unreadable record cannot
 * stop the view, and the view is how a person notices it is missing.
 */
export async function readTimings(path: string): Promise<TimingRecord[]> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch {
		return [];
	}
	const records: TimingRecord[] = [];
	for (const line of raw.split("\n")) {
		if (line.trim().length === 0) continue;
		try {
			const parsed: unknown = JSON.parse(line);
			if (isTimingRecord(parsed)) records.push(parsed);
		} catch {
			// not JSON: skipped
		}
	}
	return records;
}
