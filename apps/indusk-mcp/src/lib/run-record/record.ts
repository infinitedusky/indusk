import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A run's record (a-run-can-be-trusted, Decision 3): one JSON file per plan
 * and kind in the project's machine-state home, written whole and read back
 * safely. The admin's in-memory map is a cache; this file is the truth, so an
 * admin restart loses nothing and a run that died can be told from one still
 * going. Machine state sits outside every checkout, so a record never shows
 * as a change in a plan's tree (`/decisions/bookkeeping-lives-where-it-is-read`).
 *
 * clause: a-run-is-read-from-its-record/kept-on-disk
 */

export type RunKind = "build" | "planning" | "release";

/** The step session's own process: what liveness asks of it (`process-identity.ts`). */
export interface RunProcess {
	pid: number;
	/** The program started, to tell it from another that reused its pid. */
	bin: string;
	/** When the process started (ISO), written just after spawn. */
	startedAt: string;
}

export interface RunRecord {
	plan: string;
	kind: RunKind;
	/** The step running now, or the last one run. */
	step: string | null;
	/** The phase the step works, as the runner worded it: history, never what the page shows. */
	phase: string | null;
	/** The current step session's `claude` child; null before the first spawns and after a step ends. */
	process: RunProcess | null;
	/** When the run began (ISO). */
	startedAt: string;
	/** How the run ended on its own, as the runner's stop; null while it goes or when it died unseen. */
	stop: ({ step: string } & Record<string, unknown>) | null;
	stopReason: string | null;
	updatedAt: string;
}

const KINDS: readonly string[] = ["build", "planning", "release"];

/** A run's first record: begun now, nothing running yet. */
export function startRunRecord(plan: string, kind: RunKind, now: string): RunRecord {
	return {
		plan,
		kind,
		step: null,
		phase: null,
		process: null,
		startedAt: now,
		stop: null,
		stopReason: null,
		updatedAt: now,
	};
}

/** Where a plan's record of `kind` lives; a plan name can never leave the runs folder. */
export function runRecordPath(home: string, plan: string, kind: RunKind): string {
	return join(home, "runs", `${plan.replace(/[^A-Za-z0-9._-]/g, "_")}.${kind}.json`);
}

/** Written whole: a temporary file in the same folder, then a rename, so a reader never meets half a record. */
export function writeRunRecord(home: string, record: RunRecord): void {
	const path = runRecordPath(home, record.plan, record.kind);
	mkdirSync(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`);
	renameSync(temp, path);
}

const isString = (v: unknown): v is string => typeof v === "string";
const orNull = (v: unknown, ok: (x: unknown) => boolean): boolean => v === null || ok(v);

function isProcess(v: unknown): v is RunProcess {
	const p = v as Record<string, unknown> | null;
	return (
		typeof p === "object" &&
		p !== null &&
		typeof p.pid === "number" &&
		Number.isInteger(p.pid) &&
		isString(p.bin) &&
		isString(p.startedAt)
	);
}

function isStop(v: unknown): boolean {
	const s = v as Record<string, unknown> | null;
	return typeof s === "object" && s !== null && isString(s.step);
}

function isRecord(v: unknown): v is RunRecord {
	const r = v as Record<string, unknown> | null;
	return (
		typeof r === "object" &&
		r !== null &&
		isString(r.plan) &&
		isString(r.kind) &&
		KINDS.includes(r.kind) &&
		orNull(r.step, isString) &&
		orNull(r.phase, isString) &&
		orNull(r.process, isProcess) &&
		isString(r.startedAt) &&
		orNull(r.stop, isStop) &&
		orNull(r.stopReason, isString) &&
		isString(r.updatedAt)
	);
}

/**
 * The record on disk: `null` when there is none, `"unknown"` when the file is
 * cut off, unreadable or not a record — never a guess, never a throw, and never
 * "running", so one bad file leaves every other plan's record and the page intact.
 */
export function readRunRecord(
	home: string,
	plan: string,
	kind: RunKind,
): RunRecord | "unknown" | null {
	const path = runRecordPath(home, plan, kind);
	if (!existsSync(path)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
		return isRecord(parsed) ? parsed : "unknown";
	} catch {
		return "unknown";
	}
}
