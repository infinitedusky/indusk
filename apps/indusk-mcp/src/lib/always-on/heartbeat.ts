import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sendWatcherSpan, WATCHER_SERVICE, watcherSpanBody } from "../promises/probe.js";
import {
	DEFAULT_TIMEOUT_MS,
	type JaegerEndpoint,
	type JaegerTrace,
	jaegerGet,
} from "../promises/telemetry.js";
import { writeFileDurably } from "./durable-write.js";
import { postToSlack } from "./pass.js";

/**
 * The always-on server proves, on its own clock, that it can still hear
 * (watcher-heartbeat, ADR D2).
 *
 * Every pass sends one `watcher.heartbeat` span into the server's own intake —
 * the door a project's marks come through, with the same credential — and
 * reads back the newest one. When the newest beat is too old, or the read
 * fails, the watcher is **blind**: whatever it reports about violations is
 * a report from something that cannot hear them.
 *
 * Slack hears about it once on the way in and once on the way out, never once
 * per pass. Slack is reached over HTTPS, not through Jaeger, so the alarm
 * survives the failure it reports. As with announced violations, the state
 * is written only after Slack accepts: a message that failed is tried again
 * next pass.
 */

export const HEARTBEAT_SPAN = "watcher.heartbeat";

/** The floor on staleness: three beats at the default 60 s interval. */
export const MIN_STALE_MS = 3 * 60_000;

/** A beat older than this means the watcher is blind: `max(3 × interval, 3 min)`, unless overridden. */
export function staleAfterMs(intervalMs: number, override?: number): number {
	return override ?? Math.max(3 * intervalMs, MIN_STALE_MS);
}

export interface WatcherState {
	state: "listening" | "blind";
	/** When the current state began, ISO — for blind, the newest beat it had heard. */
	since: string;
}

export function watcherStatePath(volume: string): string {
	return join(volume, "watcher-state.json");
}

/**
 * The last state Slack was told about, or null when there is none.
 *
 * Unreadable reads as none, the opposite of the announced record's refusal:
 * the cost here is at most one repeated message, and refusing would silence
 * the alarm for as long as the file stays broken.
 */
export function readWatcherState(volume: string): WatcherState | null {
	const path = watcherStatePath(volume);
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<WatcherState>;
		if (
			(parsed.state === "listening" || parsed.state === "blind") &&
			typeof parsed.since === "string"
		) {
			return { state: parsed.state, since: parsed.since };
		}
		return null;
	} catch {
		return null;
	}
}

/** Written durably, as the announced record is — a file emptied by a stopped machine is a lost state. */
export function writeWatcherState(volume: string, state: WatcherState): void {
	writeFileDurably(watcherStatePath(volume), JSON.stringify(state, null, 1));
}

/** Write the state, or say why it could not be written — never throw past the pass. */
function tryWriteState(volume: string, state: WatcherState): string | null {
	try {
		writeWatcherState(volume, state);
		return null;
	} catch (err) {
		return `${watcherStatePath(volume)} could not be written: ${(err as Error).message}`;
	}
}

/** The newest heartbeat's time, or null when the server has none. Throws when Jaeger cannot be read. */
export async function readNewestHeartbeat(
	endpoint: JaegerEndpoint,
	now: Date,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	/**
	 * How far back to look. Narrow on purpose (the caller passes twice the
	 * staleness window): every beat in it fits under the query's limit, so the
	 * newest is read whatever order Jaeger returns them in (A12).
	 */
	lookbackMs = 24 * 3_600_000,
): Promise<Date | null> {
	const params = new URLSearchParams({
		service: WATCHER_SERVICE,
		operation: HEARTBEAT_SPAN,
		start: String((now.getTime() - lookbackMs) * 1000),
		end: String((now.getTime() + 60_000) * 1000),
		limit: "50",
	});
	const traces = await jaegerGet<JaegerTrace>(endpoint, `/api/traces?${params}`, timeoutMs);
	let newest: number | null = null;
	for (const t of traces) {
		for (const s of t.spans ?? []) {
			if (s.operationName !== HEARTBEAT_SPAN) continue;
			const ms = s.startTime / 1000;
			if (newest === null || ms > newest) newest = ms;
		}
	}
	return newest === null ? null : new Date(newest);
}

export interface HeartbeatOptions {
	volume: string;
	endpoint: JaegerEndpoint;
	/** The server's own OTLP/HTTP intake. */
	intakeUrl: string;
	webhook: string;
	/** The query API as people reach it, named in the blind message; null when not set. */
	publicQueryUrl?: string | null;
	staleMs: number;
	/**
	 * When this server started. A server with no beat yet is listening until
	 * it has been up for `staleMs` — a clean start says nothing.
	 */
	startedAt: Date;
	now?: Date;
	timeoutMs?: number;
}

export interface HeartbeatResult {
	state: "listening" | "blind";
	/** The newest beat heard, or null. */
	newestBeat: Date | null;
	/** Why it is blind, when it is. */
	reason: string | null;
	/** What Slack was told this pass, if anything. */
	told: string | null;
	/** Set when a transition was due and Slack did not accept it; the next pass tries again. */
	untold: string | null;
	/** Set when this pass's beat could not be sent. */
	sendProblem: string | null;
	/** Set when `watcher-state.json` could not be written; nothing was told (A11). */
	stateProblem?: string | null;
	/** Set when another heartbeat pass was already running against this volume. */
	skipped?: true;
}

/** What this pass judged: the state, why, and when the watcher last heard anything. */
export interface Judged {
	state: "listening" | "blind";
	reason: string | null;
	heardAt: Date;
}

/**
 * What to tell Slack and what to record, given the last state Slack was told
 * and what this pass judged. A message only on a change of state — once on
 * going blind, once on recovering — and a first record when there is none.
 */
export function watcherTransition(
	previous: WatcherState | null,
	judged: Judged,
	now: Date,
	queryUrl: string,
): { message: string | null; next: WatcherState | null } {
	if (judged.state === "blind" && previous?.state !== "blind") {
		const since = judged.heardAt.toISOString();
		return {
			message: `Watcher blind since ${since} — ${judged.reason}. Promise violations on ${queryUrl} are not being heard.`,
			next: { state: "blind", since },
		};
	}
	if (judged.state === "listening" && previous?.state === "blind") {
		return {
			message: `Watcher recovered — blind from ${previous.since} to ${now.toISOString()}. Violations marked in that time may not have been announced.`,
			next: { state: "listening", since: now.toISOString() },
		};
	}
	return {
		message: null,
		next: previous ? null : { state: judged.state, since: now.toISOString() },
	};
}

/**
 * One heartbeat pass per volume at a time: two overlapping passes would both
 * read "listening" before either wrote "blind", and Slack would hear it twice.
 */
const running = new Set<string>();

export async function heartbeatPass(opts: HeartbeatOptions): Promise<HeartbeatResult> {
	const now = opts.now ?? new Date();
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (running.has(opts.volume)) {
		return {
			state: "listening",
			newestBeat: null,
			reason: null,
			told: null,
			untold: null,
			sendProblem: null,
			skipped: true,
		};
	}
	running.add(opts.volume);
	try {
		let newestBeat: Date | null = null;
		let readProblem: string | null = null;
		try {
			newestBeat = await readNewestHeartbeat(opts.endpoint, now, timeoutMs, 2 * opts.staleMs);
		} catch (err) {
			readProblem = (err as Error).message;
		}
		const previous = readWatcherState(opts.volume);
		// The server's own start stands in for a beat only on a clean start. A
		// server restarted while blind has heard nothing new: it stays blind
		// until a real beat lands, or Slack hears a false "recovered" (A10).
		const startCounts = previous?.state !== "blind";
		const heardAt = Math.max(
			newestBeat?.getTime() ?? 0,
			startCounts ? opts.startedAt.getTime() : 0,
		);
		const reason =
			readProblem ??
			(now.getTime() - heardAt > opts.staleMs
				? heardAt > 0
					? `no heartbeat since ${new Date(heardAt).toISOString()}`
					: "no heartbeat since the server started"
				: null);
		const state = reason ? "blind" : "listening";

		let sendProblem: string | null = null;
		try {
			const { body } = watcherSpanBody(HEARTBEAT_SPAN, {}, now);
			await sendWatcherSpan(opts.intakeUrl, body, opts.endpoint.headers, timeoutMs);
		} catch (err) {
			sendProblem = (err as Error).message;
		}

		const transition = watcherTransition(
			previous,
			{ state, reason, heardAt: new Date(heardAt) },
			now,
			opts.publicQueryUrl ?? "this server",
		);
		const message = transition.message;
		let next = transition.next;

		let told: string | null = null;
		let untold: string | null = null;
		let stateProblem: string | null = null;
		if (message) {
			// Prove the state can be recorded before telling anyone: a message
			// that cannot be recorded is repeated every pass (A11). A real write
			// of the state as it stands — a clean start's is "listening", so a
			// failed post below is tried again next pass.
			stateProblem = tryWriteState(
				opts.volume,
				previous ?? { state: "listening", since: now.toISOString() },
			);
		}
		if (message && !stateProblem) {
			try {
				await postToSlack(opts.webhook, message, timeoutMs);
				told = message;
			} catch (err) {
				untold = `${message} (Slack: ${(err as Error).message})`;
				next = null;
			}
		}
		if (next && !stateProblem) stateProblem = tryWriteState(opts.volume, next);

		return { state, newestBeat, reason, told, untold, sendProblem, stateProblem };
	} finally {
		running.delete(opts.volume);
	}
}

/** What to log about a heartbeat pass, beside the violation pass's own lines. */
export function describeHeartbeat(result: HeartbeatResult): { info: string[]; errors: string[] } {
	if (result.skipped) return { info: [], errors: [] };
	const info: string[] = [];
	const errors: string[] = [];
	if (result.state === "blind") errors.push(`watcher blind — ${result.reason}`);
	else
		info.push(
			`watcher listening (newest heartbeat ${result.newestBeat?.toISOString() ?? "none yet"})`,
		);
	if (result.told) info.push(`told Slack: ${result.told}`);
	if (result.untold) errors.push(`could not tell Slack, will try again: ${result.untold}`);
	if (result.sendProblem) errors.push(`heartbeat not sent: ${result.sendProblem}`);
	if (result.stateProblem) errors.push(`told Slack nothing — ${result.stateProblem}`);
	return { info, errors };
}
