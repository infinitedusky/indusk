import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recorded } from "./incidents.js";
import { type Registry, readPromises } from "./registry.js";
import { maintenanceIncidentIds, ownerDir } from "./reopen.js";
import { alarmSource, readSources, type SourceName } from "./sources.js";
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
	/** Every open incident, with its age — read from the registry, so present whatever the sources did. */
	openIncidents: OpenIncident[];
}

/**
 * An incident someone saw and nobody has finished (incident-recording, ADR
 * D8): how long it has been open, its owner, and whether the owner carries
 * its Maintenance phase. An incident whose owner carries none is said so,
 * never hidden — that is a break no plan is working.
 *
 * promise: an-open-incident-stays-loud
 */
export interface OpenIncident {
	id: string;
	promise: string;
	owner: string;
	openedAt: string | null;
	/** Milliseconds open at `now`; null when the incident says no `opened`. */
	ageMs: number | null;
	ownerHasPhase: boolean;
}

export function openIncidents(root: string, registry: Registry, now = new Date()): OpenIncident[] {
	return registry.incidents
		.filter((i) => i.status === "open")
		.map((i) => {
			const owner = registry.promises.find((p) => p.name === i.promise)?.owner ?? "";
			const dir = owner ? ownerDir(root, owner) : null;
			const impl = dir ? join(dir, "impl.md") : null;
			const ownerHasPhase =
				!!impl && existsSync(impl) && maintenanceIncidentIds(readFileSync(impl, "utf-8")).has(i.id);
			return {
				id: i.id,
				promise: i.promise,
				owner,
				openedAt: i.opened,
				ageMs: i.opened ? now.getTime() - Date.parse(i.opened) : null,
				ownerHasPhase,
			};
		})
		.sort((a, b) => (b.ageMs ?? 0) - (a.ageMs ?? 0));
}

/** The open incidents of `root`'s registry, or none when it cannot be read. */
export function openIncidentsAt(root: string, now = new Date()): OpenIncident[] {
	const read = readPromises(root);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	return registry ? openIncidents(root, registry, now) : [];
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
		const promises = healthRows(registry, r.marks, opts.now);
		return {
			name: r.name,
			source: r.marks.queryUrl,
			ok: true,
			since: r.marks.since.toISOString(),
			promises,
			needsAttention: attention(promises),
		};
	});
	const open = openIncidents(root, registry, opts.now);
	const top = sources.find((s) => s.name === alarm.name);
	if (top?.ok) {
		const { source, since, promises, needsAttention } = top;
		return { source, since, promises, needsAttention, sources, openIncidents: open };
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
		openIncidents: open,
	};
}

function attention(rows: PromiseHealthRow[]): string[] {
	return rows.filter((r) => r.unrecorded > 0 || r.silence).map((r) => r.name);
}

/** One source's rows: per behaviour promise, what it saw and what nobody recorded. */
function healthRows(
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
		});
	}
	return rows;
}
