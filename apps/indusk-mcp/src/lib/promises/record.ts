import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { acquireLockAsync } from "../agents/lock.js";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { initEvalOtel } from "../eval/otel.js";
import { git } from "../git.js";
import { appendHeard, type HeardRow } from "./heard.js";
import { appendInbox } from "./inbox.js";
import { markPromise } from "./mark.js";
import { readPromises } from "./registry.js";
import { remind, slackPost } from "./reminders.js";
import { maintenanceHeadingName } from "./reopen.js";
import { readPromiseMarks, sourceNames } from "./sources.js";
import type { MarkedSpansResult } from "./telemetry.js";
import type { IncidentSource } from "./vocabulary.js";
import { type WatchChange, watchPromises } from "./watch.js";

/**
 * The one writer of incidents (incident-recording, ADR D1).
 *
 * Three callers — the admin's loop, catchup's `record_breaks` and `indusk
 * promises watch` — and one pass: `watchPromises` records each behaviour
 * promise's new violations and reopens its owner; this adds what recording
 * unprompted needs. It commits what it wrote, by path, in the repository that
 * holds each file, as InDusk's own (`indusk-leaves-main-clean`); an owner
 * being worked in a plan worktree keeps its Maintenance phase there, for the
 * plan's own session. It holds one lock per project, in the project's home,
 * so two callers at once make one incident. And it marks its own pass, held or
 * broken with the reason, so a recorder that cannot read or cannot write is a
 * broken promise and not a quiet week.
 *
 * Its reads and its mark are inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`).
 *
 * promise: a-production-break-is-recorded-unasked
 */

export const RECORDER_PROMISE = "a-production-break-is-recorded-unasked";

export type RecordedBy = "admin" | "catchup" | "watch";

export interface PassMark {
	outcome: "upheld" | "violated";
	symptom?: string;
}

export interface RecordOptions {
	by: RecordedBy;
	source: IncidentSource;
	now?: Date;
}

export interface RecordDeps {
	reads?: typeof readPromiseMarks;
	mark?: (mark: PassMark) => void;
	/** Slack's post, for reminders; the real one unless given. */
	post?: (webhook: string, text: string) => Promise<void>;
	/** Where the variable `promises.slack_webhook_env` names is read; `process.env` unless given. */
	env?: NodeJS.ProcessEnv;
	/** The project's home; `bookkeepingRoots(planRoot).home` unless given. */
	home?: string;
}

export interface RecordedChange {
	id: string;
	promise: string;
	owner: string;
	traces: string[];
}

export interface RecordResult {
	opened: RecordedChange[];
	extended: RecordedChange[];
	/** Open incidents whose owner's reopen was retried this pass. */
	unowned: RecordedChange[];
	/** Paths committed, relative to their repository. */
	committed: string[];
	/** Every change, as `watch` reports them, and which Jaeger answered. */
	changes: WatchChange[];
	source: string;
	/** The pass's own mark; absent when nothing was attempted (a refusal). */
	mark?: PassMark;
	/** Set when the pass was refused before it read anything, naming why. */
	refused?: string;
	/** What broke the pass, when it marked itself broken: a caller's own reporting reads it. */
	error?: Error;
}

/** How long a caller waits for another's pass before it gives up. */
const LOCK_TIMEOUT_MS = 120_000;

export async function recordBreaks(
	planRoot: string,
	opts: RecordOptions,
	deps: RecordDeps = {},
): Promise<RecordResult> {
	// A local break is work in progress (the-demo-break-is-caught-locally): a
	// project that names no production source is never recorded as production.
	if (opts.source === "deployed" && !sourceNames(planRoot).includes("production")) {
		return {
			...nothingRecorded(),
			refused: `${planRoot} names no production source (promises.jaeger in .indusk/config.json), so there is nothing to record unprompted`,
		};
	}
	const mark = deps.mark ?? realMark(planRoot);
	const home = deps.home ?? bookkeepingRoots(planRoot).home;
	mkdirSync(home, { recursive: true });
	const release = await acquireLockAsync(join(home, "recorder.lock"), {
		timeoutMs: LOCK_TIMEOUT_MS,
		staleAfterMs: LOCK_TIMEOUT_MS,
	});
	const now = opts.now ?? new Date();
	try {
		const result = await pass(planRoot, opts, deps, home, now, mark);
		await remindQuietly(planRoot, home, now, deps);
		return result;
	} finally {
		release();
	}
}

/** Watch, commit, leave the inbox and the heard record, mark: one pass under the lock. */
async function pass(
	planRoot: string,
	opts: RecordOptions,
	deps: RecordDeps,
	home: string,
	now: Date,
	mark: (m: PassMark) => void,
): Promise<RecordResult> {
	const empty = nothingRecorded();
	// What the source answered, kept so the heard record can say when each
	// violation happened.
	let heardMarks: MarkedSpansResult | null = null;
	const read = deps.reads ?? readPromiseMarks;
	const reads: typeof readPromiseMarks = async (...args) => {
		heardMarks = await read(...args);
		return heardMarks;
	};
	let watched: Awaited<ReturnType<typeof watchPromises>>;
	try {
		watched = await watchPromises(planRoot, { source: opts.source, now, reads });
	} catch (err) {
		return failed(empty, mark, err);
	}
	const result: RecordResult = {
		...empty,
		changes: watched.changes,
		source: watched.source,
		opened: pick(watched.changes, "opened"),
		extended: pick(watched.changes, "extended"),
		unowned: pick(watched.changes, "unowned"),
	};
	try {
		result.committed = await commitRecorded(planRoot, watched.changes, opts.by);
		leaveForTheMachine(home, watched.changes, heardMarks, sourceName(opts.source), now);
	} catch (err) {
		return failed(result, mark, err);
	}
	result.mark = { outcome: "upheld" };
	mark(result.mark);
	return result;
}

function nothingRecorded(): RecordResult {
	return { opened: [], extended: [], unowned: [], committed: [], changes: [], source: "" };
}

function sourceName(source: IncidentSource): string {
	return source === "deployed" ? "production" : source;
}

/**
 * What this machine keeps of a pass (ADR D5, D6): an inbox entry per opened
 * or extended incident, for the next prompt; and a heard row per violation
 * the pass recorded, for the promise page's counts.
 */
function leaveForTheMachine(
	home: string,
	changes: WatchChange[],
	marks: MarkedSpansResult | null,
	source: string,
	now: Date,
): void {
	const recorded = changes.filter((c) => c.kind === "opened" || c.kind === "extended");
	appendInbox(
		home,
		recorded.map((c) => ({
			kind: "break",
			promise: c.promise,
			incident: c.id,
			owner: c.owner,
			phase: maintenanceHeadingName(c.id),
		})),
		now,
	);
	const rows: HeardRow[] = [];
	for (const c of recorded) {
		const spans = marks?.byPromise.get(c.promise)?.violations ?? [];
		for (const trace of c.traces) {
			const span = spans.find((s) => s.traceId === trace);
			rows.push({
				at: (span?.at ?? now).toISOString(),
				promise: c.promise,
				trace,
				incident: c.id,
				source,
			});
		}
	}
	appendHeard(home, rows);
}

/** Reminders read only the registry, so they run whatever the pass did; they never fail it. */
async function remindQuietly(
	planRoot: string,
	home: string,
	now: Date,
	deps: RecordDeps,
): Promise<void> {
	const read = readPromises(planRoot);
	if (!read.ok) return;
	try {
		await remind(planRoot, read.registry, home, now, {
			post: deps.post ?? slackPost,
			env: deps.env,
		});
	} catch {
		// A reminder that could not be written is tried again next pass.
	}
}

function pick(changes: WatchChange[], kind: WatchChange["kind"]): RecordedChange[] {
	return changes
		.filter((c) => c.kind === kind)
		.map(({ id, promise, owner, traces }) => ({ id, promise, owner, traces }));
}

function failed(result: RecordResult, mark: (m: PassMark) => void, err: unknown): RecordResult {
	const error = err instanceof Error ? err : new Error(String(err));
	result.mark = { outcome: "violated", symptom: error.message };
	result.error = error;
	mark(result.mark);
	return result;
}

/**
 * Commit what a pass wrote — each incident file, each promise that now lists
 * it, and each reopened owner's impl — in the repository holding the file, one
 * commit per repository. A file in a plan worktree is the plan's to commit:
 * only the repositories holding the registry and the plan root are written.
 */
async function commitRecorded(
	planRoot: string,
	changes: WatchChange[],
	by: RecordedBy,
): Promise<string[]> {
	if (changes.length === 0) return [];
	const read = readPromises(planRoot);
	if (!read.ok) throw new Error(`the registry could not be read after recording: ${planRoot}`);
	const registry = read.registry;
	const paths = new Set<string>();
	for (const change of changes) {
		if (change.kind !== "unowned") {
			paths.add(join(registry.dir, "incidents", `${change.id}.md`));
			const promise = registry.promises.find((p) => p.name === change.promise);
			if (promise) paths.add(join(registry.dir, promise.file));
		}
		if (change.reopen.reopened) paths.add(change.reopen.impl);
	}
	const allowed = new Set([await topLevel(planRoot), await topLevel(registry.dir)]);
	const byRepo = new Map<string, string[]>();
	for (const path of paths) {
		// Real paths on both sides: git answers with the real path, and a
		// temp dir or a symlinked checkout names the same file another way.
		if (!existsSync(path)) continue;
		const real = realpathSync(path);
		const top = await topLevel(dirname(real));
		if (!allowed.has(top)) continue;
		byRepo.set(top, [...(byRepo.get(top) ?? []), relative(top, real)]);
	}
	const message = commitMessage(changes, by);
	const committed: string[] = [];
	for (const [repo, rel] of byRepo) {
		const dirty = (await git(repo, "status", "--porcelain", "--", ...rel)).trim();
		if (!dirty) continue;
		await git(repo, "add", "--", ...rel);
		await git(repo, "commit", "-q", "-m", message, "--", ...rel);
		committed.push(...rel);
	}
	return committed;
}

function commitMessage(changes: WatchChange[], by: RecordedBy): string {
	const recorded = changes.filter((c) => c.kind !== "unowned");
	if (recorded.length === 1) {
		return `chore(indusk): incident ${recorded[0].id} — ${recorded[0].promise}, recorded by ${by}`;
	}
	if (recorded.length === 0) return `chore(indusk): incidents reopened, recorded by ${by}`;
	return `chore(indusk): incidents ${recorded.map((c) => c.id).join(", ")}, recorded by ${by}`;
}

async function topLevel(dir: string): Promise<string> {
	return (await git(dir, "rev-parse", "--show-toplevel")).trim();
}

/**
 * What a pass's mark says. It names no project: the recorder is InDusk's,
 * and its promise lives in InDusk's own registry, while the passes run for
 * whichever projects name a production source. A mark naming the recorded
 * project would be dropped by the one read that holds the promise, as A7's
 * reading found.
 */
export function recorderMark(span: Parameters<typeof markPromise>[0], m: PassMark): void {
	markPromise(span, { promise: RECORDER_PROMISE, outcome: m.outcome, symptom: m.symptom });
}

/**
 * The pass's mark as a span, through the exporter InDusk's own marks use
 * (the evaluator's and the own-branch mark's). Never throws: a recorder whose
 * telemetry is down still records.
 */
function realMark(planRoot: string): (m: PassMark) => void {
	return (m) => {
		try {
			const span = initEvalOtel(planRoot).startSpan("indusk.promises.record");
			recorderMark(span, m);
			span.end();
		} catch {
			// best-effort
		}
	};
}
