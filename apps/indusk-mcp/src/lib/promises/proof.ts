import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import type { HealthDeps, SourceHealthRead } from "./health.js";
import { countHeard, type HeardRow, readHeard } from "./heard.js";
import {
	type IncidentEntry,
	type PromiseEntry,
	type Registry,
	readPromises,
	sectionText,
} from "./registry.js";
import { type PlanRow, rowsNaming } from "./rows.js";
import {
	alarmSource,
	readSources,
	type SourceName,
	type SourceRead,
	sourceNames,
} from "./sources.js";
import { readStanding } from "./standing.js";
import { readWindow } from "./store.js";

/**
 * What proves a promise (plan-cockpit, ADR decision 3): the facts a promise's
 * page shows, computed once here and read by the admin.
 *
 * - `rows` — the test rows, in any plan active or archived, that name it
 *   (`promises/rows`, never a second parse).
 * - `marks` — each place it was marked in the running system, from
 *   `promises/sources`'s reads (service and operation live on those spans).
 * - `days` — the last thirty UTC days, per source: broken from what this
 *   machine's recorder heard (`promises/heard`, which counts a break whether
 *   or not a page was open), held from the store's upheld marks
 *   (`promises/store`).
 * - `history` — declared, confirmed and changed from the promise's own
 *   `## History`, and each incident, dated.
 * - `banner` — a promise broken while every test naming it passes: the tests
 *   miss the case that breaks it. The break comes from `promises/standing`;
 *   health is not recomputed here.
 *
 * Every read is a dependency: the same shape `readHealth` takes, plus the
 * marks and the home the recorder writes, so a test hands them in.
 *
 * promise: a-promise-page-shows-its-proof
 * promise: the-admin-keeps-what-it-heard
 */

export interface ProofMark {
	service: string;
	operation: string;
	/** The newest upheld run at this place, ISO; null when none was seen. */
	lastHeld: string | null;
	/** The newest violation at this place, ISO; null when none was seen. */
	lastBroken: string | null;
}

export interface ProofDay {
	/** UTC day, `YYYY-MM-DD`. */
	day: string;
	held: number;
	broken: number;
}

export interface ProofEvent {
	/** The date, or the time, it happened — `YYYY-MM-DD` or ISO. */
	at: string;
	kind: "declared" | "confirmed" | "changed" | "incident" | "fixed" | "note";
	text: string;
}

export interface Proof {
	rows: PlanRow[];
	/** Plans whose impl could not be read: "no row names it" must not be what a broken file looks like. */
	unreadable: string[];
	marks: ProofMark[];
	/** Any run, upheld or violated, was seen in the window. A promise never seen says so. */
	seen: boolean;
	/** Thirty days, oldest first, for each source the project has. */
	days: Partial<Record<SourceName, ProofDay[]>>;
	/** Why a source's held counts are missing, for a source that could not be read. */
	unread: Partial<Record<SourceName, string>>;
	history: ProofEvent[];
	banner: { testsMissTheCase: boolean };
}

export interface ProofDeps extends HealthDeps {
	/** Where the recorder keeps what it heard; the project's home by default. */
	home?: string;
	/** Health reads already made, for the banner. */
	health?: SourceHealthRead[];
	/** The marks with their service and operation; every source's read by default. */
	marks?: (projectRoot: string, registry: Registry) => Promise<SourceRead[]>;
}

const DAY_MS = 86_400_000;
const DAYS = 30;
const TIMEOUT_MS = 2_000;

/** The proof of `name` (or an earlier name), or null when the registry holds no such promise. */
export async function proofOf(
	projectRoot: string,
	name: string,
	deps: ProofDeps = {},
): Promise<Proof | null> {
	const read = readPromises(projectRoot);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	const entry = registry?.promises.find((p) => p.name === name || p.aliases.includes(name));
	if (!registry || !entry) return null;

	const now = deps.now ?? Date.now;
	const { rows, unreadable } = rowsNaming(projectRoot, entry);
	const reads = await (deps.marks ?? ((root, r) => readSources(root, r, { now: new Date(now()) })))(
		projectRoot,
		registry,
	);
	const marks = marksOf(entry, reads);
	const standing = (await readStanding(projectRoot, deps)).find((s) => s.entry.name === entry.name);
	const { days, unread } = await daysOf(projectRoot, registry, entry, deps, now());

	return {
		rows,
		unreadable,
		marks,
		seen: marks.length > 0,
		days,
		unread,
		history: historyOf(registry, entry),
		banner: {
			testsMissTheCase:
				standing?.standing === "broken" &&
				rows.length > 0 &&
				rows.every((r) => r.state === "passing"),
		},
	};
}

/** Marks grouped by service and operation, in the order first met; a place seen only upheld has no `lastBroken`. */
function marksOf(entry: PromiseEntry, reads: SourceRead[]): ProofMark[] {
	const places = new Map<string, ProofMark>();
	const place = (service: string, operation: string): ProofMark => {
		const key = `${service}\0${operation}`;
		const held = places.get(key) ?? { service, operation, lastHeld: null, lastBroken: null };
		places.set(key, held);
		return held;
	};
	const newer = (a: string | null, b: Date) =>
		a === null || b.toISOString() > a ? b.toISOString() : a;
	for (const read of reads) {
		if (!read.ok) continue;
		const seen = read.marks.byPromise.get(entry.name);
		if (!seen) continue;
		if (seen.lastUpheld) {
			const p = place(seen.lastUpheld.service, seen.lastUpheld.operation);
			p.lastHeld = newer(p.lastHeld, seen.lastUpheld.at);
		}
		for (const v of seen.violations) {
			const p = place(v.service, v.operation);
			p.lastBroken = newer(p.lastBroken, v.at);
		}
	}
	return [...places.values()];
}

/** Thirty UTC days ending today for each source: held from the store, broken from what was heard. */
async function daysOf(
	projectRoot: string,
	registry: Registry,
	entry: PromiseEntry,
	deps: ProofDeps,
	nowMs: number,
): Promise<Pick<Proof, "days" | "unread">> {
	const today = Math.floor(nowMs / DAY_MS) * DAY_MS;
	const start = today - (DAYS - 1) * DAY_MS;
	const names = sourceNames(projectRoot);
	const heard = readHeard(deps.home ?? bookkeepingRoots(projectRoot).home).filter(
		(r) => r.promise === entry.name || entry.aliases.includes(r.promise),
	);
	const days: Partial<Record<SourceName, ProofDay[]>> = {};
	const unread: Partial<Record<SourceName, string>> = {};
	for (const source of names) {
		const broken = countHeard(
			heard.filter((r) => heardSource(r, names) === source),
			{ since: new Date(start), bucketMs: DAY_MS },
		).get(entry.name);
		const held = new Map<number, number>();
		const window = await readWindow(projectRoot, registry, source, start, TIMEOUT_MS, deps);
		if (window.ok) {
			for (const m of window.marks.get(entry.name) ?? []) {
				if (m.outcome !== "upheld") continue;
				const bucket = Math.floor(Date.parse(m.at) / DAY_MS) * DAY_MS;
				held.set(bucket, (held.get(bucket) ?? 0) + 1);
			}
		} else {
			unread[source] = window.reason;
		}
		days[source] = Array.from({ length: DAYS }, (_, i) => {
			const t = start + i * DAY_MS;
			return {
				day: new Date(t).toISOString().slice(0, 10),
				held: held.get(t) ?? 0,
				broken: broken?.get(t) ?? 0,
			};
		});
	}
	return { days, unread };
}

/**
 * Which source a heard row belongs to: a break the recorder heard on this
 * machine (`local`, `smoke`) is local's; anything else was heard from the
 * running server, which is the project's alarm source.
 */
function heardSource(row: HeardRow, names: readonly SourceName[]): SourceName {
	return row.source === "local" || row.source === "smoke" ? "local" : alarmSource(names);
}

/** The promise file's dated `## History` lines and its incidents, oldest first. */
function historyOf(registry: Registry, entry: PromiseEntry): ProofEvent[] {
	const events: ProofEvent[] = [];
	const body = matter(readFileSync(join(registry.dir, entry.file), "utf-8")).content;
	for (const line of sectionText(body, "History").split("\n")) {
		const m = /^-\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+(.+)$/.exec(line.trim());
		if (m) events.push({ at: m[1], kind: kindOf(m[2]), text: m[2] });
	}
	for (const i of registry.incidents.filter((x) => x.promise === entry.name)) {
		events.push(...incidentEvents(i));
	}
	return events
		.map((e, order) => ({ e, order }))
		.sort((a, b) => a.e.at.localeCompare(b.e.at) || a.order - b.order)
		.map(({ e }) => e);
}

function incidentEvents(i: IncidentEntry): ProofEvent[] {
	const events: ProofEvent[] = [
		{ at: i.opened ?? i.date, kind: "incident", text: `${i.id}: ${i.symptom.split("\n")[0]}` },
	];
	if (i.fixed) events.push({ at: i.fixed, kind: "fixed", text: `${i.id} fixed` });
	return events;
}

function kindOf(text: string): ProofEvent["kind"] {
	const first = text.trim().toLowerCase();
	if (first.startsWith("declared")) return "declared";
	if (first.startsWith("enforced") || first.includes("confirmed")) return "confirmed";
	if (first.startsWith("changed")) return "changed";
	return "note";
}
