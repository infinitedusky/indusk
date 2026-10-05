import { randomBytes } from "node:crypto";
import {
	DEFAULT_TIMEOUT_MS,
	type JaegerEndpoint,
	type JaegerTrace,
	jaegerGet,
	normalizeJaegerUrl,
} from "./telemetry.js";
import { PROMISE_MARK } from "./vocabulary.js";

/**
 * Proof that the watcher can hear (watcher-heartbeat, ADR D1).
 *
 * A Jaeger that answers is not a Jaeger that hears. On 2026-10-01 a test's
 * leaked Jaeger answered on the default ports, and every promise reader
 * reported this repository's behaviour promises healthy after seven silent
 * days: reachable read as listening. So before any promise is read, one span
 * goes in through the source's intake and has to come back out of its query
 * API. A span that does not come back means the reader is looking at
 * something that is not receiving this project's telemetry — a stranger on
 * the port, a broken intake, a dropped pipeline — and it says *watcher blind*
 * instead of a count.
 */

/** The service every watcher span is sent as — the probe here, the server's heartbeat. */
export const WATCHER_SERVICE = "indusk-watcher";
export const PROBE_SPAN = "watcher.probe";
export const PROBE_ID_ATTRIBUTE = "indusk.probe.id";

/** How long a probe that came back vouches for its source (A4). */
export const PROBE_CACHE_MS = 30_000;
/** How long to wait for Jaeger to index the probe before calling the watcher blind. */
export const PROBE_WAIT_MS = 5_000;
const PROBE_POLL_MS = 200;
/**
 * The least time the query API is given after a failed send that used the
 * whole budget: enough for a host that answers to say so, short enough that a
 * silent one is reported as unreachable without doubling the wait.
 */
const CHECK_FLOOR_MS = 250;

/**
 * The watcher answered, but did not hear: a span sent to its intake never
 * came back from its query API. Reported in place of counts, never as zero —
 * the same contract as `JaegerUnreachable`, for a different fact.
 */
export class WatcherBlind extends Error {
	/** The query API that was asked for the probe. */
	readonly where: string;
	/** The intake the probe was sent to, or the config key that should have named one. */
	readonly intake: string;
	readonly reason: string;
	constructor(where: string, intake: string, reason: string) {
		super(`watcher blind — a probe sent to ${intake} did not come back from ${where}: ${reason}`);
		this.name = "WatcherBlind";
		this.where = where;
		this.intake = intake;
		this.reason = reason;
	}
}

/** A source to probe: the query API a reader reads, and the intake that feeds it. */
export interface ProbeTarget {
	endpoint: JaegerEndpoint;
	/** `http://host:port` of the OTLP/HTTP intake, or null when nothing names one. */
	intakeUrl: string | null;
	/** What a reader should be told to set when `intakeUrl` is null. */
	missingIntake?: string;
}

function hex(bytes: number): string {
	return randomBytes(bytes).toString("hex");
}

type AttrValue = string | number | boolean;

function attribute(key: string, value: AttrValue) {
	const v =
		typeof value === "string"
			? { stringValue: value }
			: typeof value === "boolean"
				? { boolValue: value }
				: Number.isInteger(value)
					? { intValue: String(value) }
					: { doubleValue: value };
	return { key, value: v };
}

/**
 * One `indusk-watcher` span as an OTLP/JSON export body — the probe's and the
 * server heartbeat's shape, so both travel the path a promise mark does.
 */
export function watcherSpanBody(
	name: string,
	attributes: Record<string, AttrValue>,
	at: Date = new Date(),
): { body: unknown; traceId: string } {
	const traceId = hex(16);
	const nanos = BigInt(at.getTime()) * 1_000_000n;
	return {
		traceId,
		body: {
			resourceSpans: [
				{
					resource: { attributes: [attribute("service.name", WATCHER_SERVICE)] },
					scopeSpans: [
						{
							scope: { name: WATCHER_SERVICE },
							spans: [
								{
									traceId,
									spanId: hex(8),
									name,
									kind: 1,
									startTimeUnixNano: String(nanos),
									endTimeUnixNano: String(nanos + 1_000_000n),
									attributes: Object.entries(attributes).map(([k, v]) => attribute(k, v)),
								},
							],
						},
					],
				},
			],
		},
	};
}

/**
 * POST one OTLP/JSON body to `intakeUrl`. Throws with a reason a person can
 * act on; the caller decides what that failure means.
 */
export async function sendWatcherSpan(
	intakeUrl: string,
	body: unknown,
	headers: Record<string, string> = {},
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
	const url = `${normalizeJaegerUrl(intakeUrl)}/v1/traces`;
	let res: Response;
	try {
		res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (err) {
		throw new Error(`${url} could not be reached: ${(err as Error).message}`);
	}
	if (!res.ok) throw new Error(`${url} refused the span (${res.status})`);
}

/** Success per query URL, until it expires. A failure is never cached. */
const heard = new Map<string, number>();

/** Forget every cached probe — for a reader that must ask again now. */
export function forgetProbes(): void {
	heard.clear();
}

/**
 * Prove `target` hears, or throw `WatcherBlind`.
 *
 * `JaegerUnreachable` from the query passes through untouched: "nobody
 * answered" stays its own answer (A3), and this only adds "somebody answered
 * and did not hear".
 */
export async function probeWatcher(
	target: ProbeTarget,
	opts: { project: string; now?: () => number; waitMs?: number },
): Promise<void> {
	const now = opts.now ?? Date.now;
	const where = target.endpoint.queryUrl;
	const until = heard.get(where);
	if (until !== undefined && until > now()) return;

	if (!target.intakeUrl) {
		const key = target.missingIntake ?? "an OTLP intake";
		throw new WatcherBlind(
			where,
			key,
			`${key} is not set, so nothing can be sent to prove it hears`,
		);
	}

	const probeId = hex(8);
	const sentAt = Date.now();
	const { body } = watcherSpanBody(PROBE_SPAN, {
		[PROMISE_MARK.project]: opts.project,
		[PROBE_ID_ATTRIBUTE]: probeId,
	});
	// One budget for the send and, when it fails, the check that follows: a
	// host that accepts connections and never answers must not hold a reader
	// past its own timeout (promise-sources A9) — `readSources` waits for every
	// source, so one silent source would stall the other with it.
	const budgetMs = opts.waitMs ?? DEFAULT_TIMEOUT_MS;
	const sendDeadline = Date.now() + budgetMs;
	try {
		await sendWatcherSpan(target.intakeUrl, body, target.endpoint.headers, budgetMs);
	} catch (err) {
		// A refused intake beside a query API that answers is blind; when the
		// query API does not answer either, nobody is there, and that is its own
		// answer (promise-sources A4). This throws `JaegerUnreachable` if so.
		const leftMs = Math.max(sendDeadline - Date.now(), CHECK_FLOOR_MS);
		await jaegerGet(target.endpoint, "/api/services", leftMs);
		throw new WatcherBlind(where, target.intakeUrl, (err as Error).message);
	}

	const params = new URLSearchParams({
		service: WATCHER_SERVICE,
		operation: PROBE_SPAN,
		tags: JSON.stringify({ [PROBE_ID_ATTRIBUTE]: probeId }),
		start: String((sentAt - 60_000) * 1000),
		limit: "1",
	});
	const waitMs = opts.waitMs ?? PROBE_WAIT_MS;
	const deadline = Date.now() + waitMs;
	for (;;) {
		params.set("end", String((Date.now() + 60_000) * 1000));
		const traces = await jaegerGet<JaegerTrace>(
			target.endpoint,
			`/api/traces?${params}`,
			DEFAULT_TIMEOUT_MS,
		);
		if (traces.some((t) => t.spans?.length)) {
			heard.set(where, now() + PROBE_CACHE_MS);
			return;
		}
		if (Date.now() >= deadline) {
			throw new WatcherBlind(
				where,
				target.intakeUrl,
				`the probe was accepted and never appeared in ${Math.round(waitMs / 1000)} s`,
			);
		}
		await new Promise((r) => setTimeout(r, PROBE_POLL_MS));
	}
}
