import { join } from "node:path";
import { recorded, violationState } from "./incidents.js";
import type { IncidentEntry, PromiseEntry } from "./registry.js";
import { type Registry, readPromises } from "./registry.js";
import {
	alarmSource,
	healthWindowMs,
	probeSources,
	readSources,
	type SourceName,
	type SourceRead,
	sourceNames,
	WatcherBlind,
} from "./sources.js";
import { asMarkedSpans, readWindow, type StoreDeps } from "./store.js";
import { type MarkedSpansResult, newestMark, silencePastExpectation } from "./telemetry.js";

/**
 * What a session should be told about the promises (day-always-on, ADR D9).
 *
 * The raising half of the loop. A violation that nobody hears about is not
 * raised, and the agent answering "what's next" is where a developer actually
 * hears things — so this is the shape that answer needs: per behaviour
 * promise, what broke in the window, what is already written down as an
 * incident, and **what broke that nobody has written down yet**.
 *
 * That third number is the one that matters. Violations already carrying an
 * open incident are work someone has seen; `unrecorded` is work nobody has,
 * and it is what `indusk promises watch` would record if it ran now.
 *
 * Reads through `readSources` — the same reads `status`, `watch` and the
 * admin use — so this cannot disagree with the CLI about what happened. Two
 * surfaces reporting different violation counts is worse than one surface.
 *
 * Per source (promise-sources, ADR D4): `sources` holds each source's rows,
 * or its failure. The top-level fields are the **alarm source's** —
 * production when the project names one — so a consumer that predates
 * sources reads what it read before, and a local break during development is
 * shown under `sources` without being raised.
 */

export interface PromiseHealthRow {
	name: string;
	kind: string;
	state: string;
	owner: string;
	/** Violations in the window. */
	violations: number;
	/** The query hit Jaeger's limit: `violations` is a lower bound. */
	atLeast?: boolean;
	/** Open incidents for this promise. */
	incidents: number;
	/** Violations whose traces no incident records — what `watch` would open. */
	unrecorded: number;
	/** The unrecorded traces themselves, newest first, so a reader can go look. */
	unrecordedTraces: string[];
	/** ISO time of the newest mark, or null when nothing was seen. */
	lastSeen: string | null;
	/** The promise's state, by the one rule every window uses (`healthOf`). */
	health: PromiseHealth;
	/**
	 * Set when the promise declares `expect_every` and has been silent longer
	 * — "silent for 3h, expected every 1h" (watcher-heartbeat, ADR D3).
	 */
	silence?: string;
}

/** One source's health: its rows, or why it has none. */
export type SourceHealth =
	| {
			name: SourceName;
			/** The query URL that answered. */
			source: string;
			ok: true;
			since: string;
			promises: PromiseHealthRow[];
			needsAttention: string[];
	  }
	| {
			name: SourceName;
			/** Where it looked. */
			source: string;
			ok: false;
			kind: "unreachable" | "blind";
			reason: string;
	  };

export interface PromiseHealthReport {
	/** Which Jaeger the alarm source is — the local daemon or the project's named server. */
	source: string;
	/** The window these numbers cover. */
	since: string;
	/** The alarm source's rows; null when the alarm source could not be read. */
	promises: PromiseHealthRow[] | null;
	/**
	 * The alarm source's promises with unrecorded violations, or silent past
	 * their `expect_every` — the "what's next" answer. Null when the alarm
	 * source could not be read: nobody looked, which is not "nothing to do".
	 */
	needsAttention: string[] | null;
	/** Set when the alarm source could not be read: what went wrong there. */
	error?: string;
	/** The alarm source answered and did not hear. */
	blind?: true;
	/** Every source, each with its own rows or its own failure. */
	sources: SourceHealth[];
}

/**
 * Throws only when no source could be read — the alarm source's error, so a
 * one-source project fails exactly as before.
 */
export async function promiseHealth(
	root: string,
	opts: { sinceMs?: number; timeoutMs?: number; now?: Date } = {},
): Promise<PromiseHealthReport> {
	const read = readPromises(root);
	// A malformed entry does not hide its neighbours: the partial registry is
	// still read, exactly as the admin and `check` treat it. Only a registry
	// that is not there at all is nothing to report on.
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	if (!registry) {
		throw new Error(`no promise registry at ${"missing" in read ? read.missing : root}`);
	}

	const reads = await readSources(root, registry, opts);
	const alarm = reads.find((r) => r.name === alarmSource(reads.map((r) => r.name)));
	if (!alarm) throw new Error("no promise source resolved");
	if (!alarm.ok && !reads.some((r) => r.ok)) throw alarm.error;

	const sources: SourceHealth[] = reads.map((r) => {
		if (!r.ok) return { name: r.name, source: r.where, ok: false, kind: r.kind, reason: r.reason };
		const promises = reportRows(registry, r.marks, opts.now);
		return {
			name: r.name,
			source: r.marks.queryUrl,
			ok: true,
			since: r.marks.since.toISOString(),
			promises,
			needsAttention: attention(promises),
		};
	});
	const top = sources.find((s) => s.name === alarm.name);
	if (top?.ok) {
		const { source, since, promises, needsAttention } = top;
		return { source, since, promises, needsAttention, sources };
	}
	// The alarm source failed beside one that answered: say production's
	// failure at the top, in the shape a session already reads as "nobody
	// could look", and keep the other's rows under `sources`.
	const answered = sources.find((s) => s.ok);
	return {
		source: alarm.label,
		since: answered?.ok ? answered.since : "",
		promises: null,
		needsAttention: null,
		...(alarm.ok ? {} : { error: alarm.error.message }),
		...(alarm.ok || alarm.kind !== "blind" ? {} : { blind: true as const }),
		sources,
	};
}

function attention(rows: PromiseHealthRow[]): string[] {
	return rows.filter((r) => r.unrecorded > 0 || r.silence).map((r) => r.name);
}

/**
 * One source's rows for the agents' report: per behaviour promise, what it
 * saw, what nobody recorded, and its state by the same rule the admin's chips
 * and the editor use (`healthOf`, vscode-extension A6).
 */
export function reportRows(
	registry: Registry,
	marks: MarkedSpansResult,
	now: Date | undefined,
): PromiseHealthRow[] {
	const rows: PromiseHealthRow[] = [];
	for (const promise of registry.promises) {
		if (promise.kind !== "behaviour" || promise.state === "retired") continue;
		const seen = marks.byPromise.get(promise.name);
		const violations = seen?.violations ?? [];

		const mine = registry.incidents.filter((i) => i.promise === promise.name);
		const known = new Set(mine.flatMap((i) => recorded(join(registry.dir, i.file)).traces));
		const unrecordedTraces = [
			...new Set(violations.filter((v) => !known.has(v.traceId)).map((v) => v.traceId)),
		];

		const silence = silencePastExpectation(promise, marks, now);
		rows.push({
			...(silence ? { silence } : {}),
			name: promise.name,
			kind: promise.kind,
			state: promise.state,
			owner: promise.owner,
			violations: violations.length,
			...(seen?.truncated ? { atLeast: true } : {}),
			incidents: mine.filter((i) => i.status === "open").length,
			unrecorded: unrecordedTraces.length,
			unrecordedTraces,
			lastSeen: newestMark(seen)?.toISOString() ?? null,
			health:
				healthOf(
					promise,
					{ ok: true, at: (now ?? new Date()).toISOString(), marks },
					registry.incidents,
				)?.health ?? "unverified",
		});
	}
	return rows;
}

/**
 * Observed health on the Promises page and in the sidebar (day-monitor, ADR
 * D9).
 *
 * One read per source per project (promise-sources, ADR D7) — `local`, and
 * `production` when the project names one — through the package's reads
 * (`promises/sources`), with a two-second timeout and cached for the
 * project's refresh interval so a page and its sidebar share it. A source
 * that cannot be read says so and remembers when it last succeeded — "health
 * unknown since …" — and no chip is drawn green; the other source is still
 * shown. The sidebar's red comes from the alarm source alone.
 *
 * Moved from the admin into the package by vscode-extension (A7), so the
 * admin, `indusk promises health` and the editor read one health. Server-side
 * only.
 */

export const PROMISE_HEALTHS = ["red", "fixed", "green", "unverified", "amber", "grey"] as const;
export type PromiseHealth = (typeof PROMISE_HEALTHS)[number];

export interface HealthRow {
	health: PromiseHealth;
	/** Violations in the window; null when telemetry says nothing about this promise. */
	violations: number | null;
	/** The query hit its limit: `violations` is a lower bound (day-monitor A30). */
	atLeast?: boolean;
	/** ISO time of the newest mark, upheld or violated. */
	lastSeen: string | null;
	/**
	 * Where the newest violation happened, as its span said (day-always-on D6),
	 * or null when it said nothing. One server holds staging and production, so
	 * a red row that cannot say which is a red row nobody can act on.
	 */
	environment?: string | null;
	/**
	 * Set when the promise declares `expect_every` and has been silent longer
	 * (watcher-heartbeat, ADR D3) — the shared judgment, never restated here.
	 */
	silence?: string;
}

export type HealthRead =
	| { ok: true; at: string; marks: MarkedSpansResult }
	| {
			ok: false;
			unknownSince: string | null;
			where: string;
			/**
			 * The watcher answered and did not hear (watcher-heartbeat): a probe sent
			 * to `intake` never came back from `where`. Absent when it could not be
			 * reached at all.
			 */
			blind?: { intake: string };
	  };

/** One source's read, named: what the page draws a chip and a banner from. */
export type SourceHealthRead = HealthRead & {
	name: SourceName;
	/** Where it read — its query URL, or what was consulted when it could not. */
	label: string;
};

const TIMEOUT_MS = 2_000;
const DEFAULT_CACHE_MS = 5_000;
const cache = new Map<string, { expires: number; reads: SourceHealthRead[] }>();
const lastOk = new Map<string, string>();

/**
 * What the health read reads with: the store's clock and reads, and how it
 * probes each source's watcher. The real ones by default (test-kinds, ADR D2).
 */
export interface HealthDeps extends StoreDeps {
	probe?: typeof probeSources;
	/** How long a read is reused — the admin passes its refresh interval. */
	cacheMs?: number;
}

export async function readHealth(
	projectRoot: string,
	registry: Registry,
	deps: HealthDeps = {},
): Promise<SourceHealthRead[]> {
	const now = deps.now ?? Date.now;
	const hit = cache.get(projectRoot);
	if (hit && hit.expires > now()) return hit.reads;
	let reads: SourceHealthRead[];
	try {
		// The watcher is probed every time; the marks come from the store, which
		// reads only what it has not read (promise-timeline A12). A refresh with
		// nothing new no longer moves the whole window.
		const probed = await (deps.probe ?? probeSources)(projectRoot, {
			timeoutMs: TIMEOUT_MS,
		});
		const since = new Date(now() - healthWindowMs(projectRoot, registry));
		reads = await Promise.all(
			probed.map(async (p): Promise<SourceHealthRead> => {
				if (!p.ok) return fromSource(projectRoot, p, now());
				const w = await readWindow(
					projectRoot,
					registry,
					p.name,
					since.getTime(),
					TIMEOUT_MS,
					deps,
				);
				if (!w.ok) {
					return {
						name: w.name,
						label: w.label,
						ok: false,
						unknownSince: lastOk.get(`${projectRoot}\0${w.name}`) ?? null,
						where: w.where,
					};
				}
				return fromSource(
					projectRoot,
					{
						name: p.name,
						label: p.label,
						ok: true,
						marks: asMarkedSpans(w, since),
					},
					now(),
				);
			}),
		);
	} catch (err) {
		// A health read never takes a page down (day-monitor A26): whatever went
		// wrong, every source's answer is "unknown since the last good read".
		reads = sourceNames(projectRoot).map((name) => ({
			name,
			label: (err as Error).message,
			ok: false,
			unknownSince: lastOk.get(`${projectRoot}\0${name}`) ?? null,
			where: (err as Error).message,
		}));
	}
	cache.set(projectRoot, {
		expires: now() + (deps.cacheMs ?? DEFAULT_CACHE_MS),
		reads,
	});
	return reads;
}

function fromSource(projectRoot: string, r: SourceRead, nowMs: number): SourceHealthRead {
	const key = `${projectRoot}\0${r.name}`;
	if (r.ok) {
		const at = new Date(nowMs).toISOString();
		lastOk.set(key, at);
		return { name: r.name, label: r.label, ok: true, at, marks: r.marks };
	}
	return {
		name: r.name,
		label: r.label,
		ok: false,
		unknownSince: lastOk.get(key) ?? null,
		where: r.where,
		...(r.error instanceof WatcherBlind ? { blind: { intake: r.error.intake } } : {}),
	};
}

/** The read whose red raises the alarm: production when there is one (ADR D5). */
export function alarmRead(reads: SourceHealthRead[]): SourceHealthRead | undefined {
	const name = alarmSource(reads.map((r) => r.name));
	return reads.find((r) => r.name === name);
}

/**
 * One promise's chip. Retired is grey and known-violated amber whatever
 * telemetry says; a behaviour promise is red when violated in the window,
 * green when seen upheld, hollow "unverified" when not seen or when Jaeger
 * could not be read. A state or structure promise has no observed health —
 * its health is the suite's — so it gets no chip (null).
 */
/**
 * How a source's chip judges a promise's violations (promise-timeline, ADR D3).
 *
 * - `incidents` — production's, or the only source's: red while any violation
 *   in the window is unrecorded or its incident open; `fixed` once every one
 *   of them is fixed. A mended promise is not called broken for a week.
 * - `newest` — local's, beside a production source: the newest local run
 *   decides. A local break during development is work in progress; nobody
 *   records an incident for it, so the incident rule would leave it red for
 *   the whole window after the fix.
 */
export type HealthRule = "incidents" | "newest";

/**
 * One promise's chip. Retired is grey and known-violated amber whatever
 * telemetry says, unless a live break makes it red; a behaviour promise is
 * red, `fixed`, green or hollow "unverified" by its source's rule. A state or
 * structure promise has no observed health — its health is the suite's — so
 * it gets no chip (null).
 */
export function healthOf(
	p: PromiseEntry,
	read: HealthRead | null,
	incidents: IncidentEntry[] = [],
	rule: HealthRule = "incidents",
): HealthRow | null {
	if (p.state === "retired") return { health: "grey", violations: null, lastSeen: null };
	const marks = read?.ok ? read.marks.byPromise.get(p.name) : undefined;
	const violations = marks ? marks.violations.length : null;
	const newest = newestMark(marks);
	const lastSeen = newest?.toISOString() ?? null;
	const red = (): HealthRow => ({
		health: "red",
		violations,
		lastSeen,
		environment: marks?.violations[0]?.environment ?? null,
		...(marks?.truncated ? { atLeast: true } : {}),
	});
	if (p.kind === "behaviour" && marks && marks.violations.length > 0) {
		const live =
			rule === "newest"
				? newest?.getTime() === marks.violations[0].at.getTime()
				: marks.violations.some((v) => violationState(v.traceId, incidents) !== "fixed");
		if (live) return red();
	}
	if (p.state === "known-violated") return { health: "amber", violations, lastSeen };
	if (p.kind !== "behaviour") return null;
	const silence = read?.ok ? silencePastExpectation(p, read.marks) : null;
	const quiet = silence ? { silence } : {};
	if (rule === "incidents" && violations !== null && violations > 0)
		return { health: "fixed", violations, lastSeen, ...quiet };
	if (marks?.lastUpheld) return { health: "green", violations, lastSeen, ...quiet };
	return { health: "unverified", violations, lastSeen, ...quiet };
}

/** Every promise's row, by name, for the page and the sidebar. */
export function healthRows(
	registry: Registry,
	read: HealthRead | null,
	rule: HealthRule = "incidents",
): Record<string, HealthRow> {
	const out: Record<string, HealthRow> = {};
	for (const p of registry.promises) {
		const row = healthOf(p, read, registry.incidents, rule);
		if (row) out[p.name] = row;
	}
	return out;
}

/**
 * Plans holding a red promise in the alarm source — the sidebar's roll-up
 * (A23). A promise red only locally, beside a production that holds it, is
 * work in progress and does not mark its plan (promise-sources A6).
 */
export function redPlans(registry: Registry, reads: SourceHealthRead[]): Set<string> {
	const rows = healthRows(registry, alarmRead(reads) ?? null);
	return new Set(
		registry.promises.filter((p) => rows[p.name]?.health === "red").map((p) => p.owner),
	);
}

/**
 * The rule a source's chip is judged by: `newest` for local when the project
 * also has production, `incidents` otherwise (ADR D3).
 */
export function ruleFor(read: SourceHealthRead, reads: SourceHealthRead[]): HealthRule {
	return read.name === "local" && reads.some((r) => r.name === "production")
		? "newest"
		: "incidents";
}

/** One promise's row in a `promises health --json` line. */
export interface HealthLineRow {
	promise: string;
	state: PromiseHealth;
	lastSeen: string | null;
	violations: number | null;
	symptom?: string;
	traceId?: string;
	environment?: string | null;
	tests: string[];
}

/** One line of `indusk promises health --json`: every source's state for every promise, or why a source has none. */
export interface HealthLine {
	at: string;
	/**
	 * Every promise the project has, so a window can name one at its token and
	 * on hover without reading the registry itself — state and structure
	 * promises too, which have no row below (telemetry does not watch them).
	 */
	promises: { name: string; kind: string; statement: string; tests: string[]; sites: string[] }[];
	sources: (
		| { name: SourceName; label: string; ok: true; rows: HealthLineRow[] }
		| { name: SourceName; label: string; ok: false; reason: string; blind?: true }
	)[];
}

/**
 * The line `promises health --json` prints, built from the reads `readHealth`
 * returns, by the same rule the admin's chips use — the editor reads this, so
 * it cannot disagree with the admin (vscode-extension A6).
 */
export function healthLine(registry: Registry, reads: SourceHealthRead[], now: Date): HealthLine {
	return {
		at: now.toISOString(),
		promises: registry.promises
			.filter((p) => p.state !== "retired")
			.map((p) => ({
				name: p.name,
				kind: p.kind,
				statement: p.statement,
				tests: p.tests ?? [],
				sites: p.sites ?? [],
			})),
		sources: reads.map((read) => {
			if (!read.ok) {
				return {
					name: read.name,
					label: read.label,
					ok: false as const,
					reason: read.blind
						? `watcher blind — a probe sent to ${read.blind.intake} did not come back from ${read.where}`
						: `could not be read: ${read.where}`,
					...(read.blind ? { blind: true as const } : {}),
				};
			}
			const rule = ruleFor(read, reads);
			const rows: HealthLineRow[] = [];
			for (const p of registry.promises) {
				const row = healthOf(p, read, registry.incidents, rule);
				if (!row) continue;
				const newestViolation = read.marks.byPromise.get(p.name)?.violations[0];
				rows.push({
					promise: p.name,
					state: row.health,
					lastSeen: row.lastSeen,
					violations: row.violations,
					...(newestViolation?.symptom ? { symptom: newestViolation.symptom } : {}),
					...(newestViolation
						? { traceId: newestViolation.traceId, environment: newestViolation.environment ?? null }
						: {}),
					tests: p.tests ?? [],
				});
			}
			return { name: read.name, label: read.label, ok: true as const, rows };
		}),
	};
}
