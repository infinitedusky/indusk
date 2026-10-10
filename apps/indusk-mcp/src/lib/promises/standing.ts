import { bookkeepingRoots } from "../bookkeeping/roots.js";
import {
	type HealthDeps,
	type HealthRow,
	healthRows,
	type PromiseHealth,
	readHealth,
	ruleFor,
	type SourceHealthRead,
} from "./health.js";
import { type HeardRow, readHeard } from "./heard.js";
import { type PromiseEntry, type Registry, readPromises } from "./registry.js";
import { type PlanRow, rowsNamingEach } from "./rows.js";
import { alarmSource, type SourceName } from "./sources.js";

/**
 * Where a promise stands (plan-cockpit, ADR decision 1): the one word the
 * dashboard groups and orders by, worked out here so the dashboard, a
 * promise's page and the nav's broken count cannot disagree.
 *
 * Health is never recomputed: each source's row comes from `promises/health`
 * (`healthRows`, by the source's own rule), and *broken* is red from the alarm
 * source — production when the project names one, otherwise local — exactly
 * as the sidebar's red is. What this module adds is the part health does not
 * know: whether the plan's tests for the promise are yet written and passing.
 *
 * promise: every-promise-is-listed
 */

/**
 * `broken` — red from the alarm source, or known to be violated.
 * `being-proven` — declared, with test rows written and not all passing.
 * `declared` — stated, nothing proving it yet. `enforced` — upheld.
 */
export type Standing = "broken" | "being-proven" | "declared" | "enforced" | "retired";

/** One source's health row for a promise, named by the source that read it. */
export interface SourcedHealth extends HealthRow {
	source: SourceName;
}

export interface StandingResult {
	standing: Standing;
	/** Each source's chip for the promise; a source that cannot be read, or says nothing of a promise, is absent. */
	health: Partial<Record<SourceName, PromiseHealth>>;
	/** The test rows that name it, passing and in all. */
	tests: { passing: number; total: number };
	/** The newest time any source saw it, ISO; null when none did. */
	lastActivity: string | null;
	/** What the last thirty days hold, from what this machine's recorder heard. */
	thirtyDays: ThirtyDays;
	/** The newest break: a heard violation, or the alarm source's sighting while broken and newer; null when none. */
	lastBreak: string | null;
}

/**
 * The dashboard's "held N · broke M of 30 days": `broke` is the violations
 * heard, `held` the days of the thirty without one, and null while the
 * promise has never been seen or heard (nothing was held, nothing watched).
 */
export interface ThirtyDays {
	broke: number;
	held: number | null;
}

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export interface StandingRow extends StandingResult {
	entry: PromiseEntry;
	rows: PlanRow[];
}

/** What the health read reads with; `health` hands over reads already made. */
export interface StandingDeps extends HealthDeps {
	health?: SourceHealthRead[];
	/** What the recorder heard; the project's home's record by default. */
	heard?: HeardRow[];
}

/**
 * `sources` names every source the project has, including one that could not
 * be read, so the alarm source is the project's and not whichever answered:
 * a local red beside an unread production is work in progress, not a break.
 */
export function standingOf(
	entry: PromiseEntry,
	health: SourcedHealth[],
	rows: PlanRow[],
	sources: readonly SourceName[] = health.map((h) => h.source),
	ctx: { heard?: HeardRow[]; now?: number } = {},
): StandingResult {
	const byName: Partial<Record<SourceName, PromiseHealth>> = {};
	for (const h of health) byName[h.source] = h.health;
	const tests = { passing: rows.filter((r) => r.state === "passing").length, total: rows.length };
	const newest = health.reduce<string | null>(
		(latest, h) => (h.lastSeen && (latest === null || h.lastSeen > latest) ? h.lastSeen : latest),
		null,
	);
	const standing = standingFor(entry, byName, tests, sources);
	const { thirtyDays, lastBreak } = heardOver(entry, standing, newest, ctx);
	return { standing, health: byName, tests, lastActivity: newest, thirtyDays, lastBreak };
}

/** The thirty days and the last break, from the breaks heard for this promise (or an earlier name of it). */
function heardOver(
	entry: PromiseEntry,
	standing: Standing,
	lastActivity: string | null,
	ctx: { heard?: HeardRow[]; now?: number },
): { thirtyDays: ThirtyDays; lastBreak: string | null } {
	const since = (ctx.now ?? Date.now()) - WINDOW_DAYS * DAY_MS;
	const heard = (ctx.heard ?? []).filter(
		(h) =>
			(h.promise === entry.name || entry.aliases.includes(h.promise)) && Date.parse(h.at) >= since,
	);
	const heardLatest = heard.reduce<string | null>(
		(latest, h) => (latest === null || h.at > latest ? h.at : latest),
		null,
	);
	const brokenDays = new Set(heard.map((h) => h.at.slice(0, 10))).size;
	const lastBreak =
		standing === "broken" && lastActivity && (!heardLatest || lastActivity > heardLatest)
			? lastActivity
			: heardLatest;
	return {
		thirtyDays: {
			broke: heard.length,
			held: lastActivity || heard.length ? WINDOW_DAYS - brokenDays : null,
		},
		lastBreak,
	};
}

function standingFor(
	entry: PromiseEntry,
	health: Partial<Record<SourceName, PromiseHealth>>,
	tests: { passing: number; total: number },
	sources: readonly SourceName[],
): Standing {
	if (entry.state === "retired") return "retired";
	if (health[alarmSource(sources)] === "red" || entry.state === "known-violated") return "broken";
	if (entry.state === "declared") {
		return tests.total > 0 && tests.passing < tests.total ? "being-proven" : "declared";
	}
	return "enforced";
}

/**
 * Every promise of the project with its standing: the registry, one health
 * read, and the test rows of every plan, active and archived. A registry with
 * a malformed entry still reads its well-formed neighbours.
 */
export async function readStanding(
	projectRoot: string,
	deps: StandingDeps = {},
): Promise<StandingRow[]> {
	const read = readPromises(projectRoot);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	if (!registry) return [];
	const reads = deps.health ?? (await readHealth(projectRoot, registry, deps));
	const heard = deps.heard ?? readHeard(bookkeepingRoots(projectRoot).home);
	return standingRows(projectRoot, registry, reads, { heard, now: (deps.now ?? Date.now)() });
}

function standingRows(
	projectRoot: string,
	registry: Registry,
	reads: SourceHealthRead[],
	ctx: { heard: HeardRow[]; now: number },
): StandingRow[] {
	const chips = reads.flatMap((r) =>
		r.ok ? [{ source: r.name, rows: healthRows(registry, r, ruleFor(r, reads)) }] : [],
	);
	const named = rowsNamingEach(projectRoot, registry.promises);
	const sources = reads.map((r) => r.name);
	return registry.promises.map((entry) => {
		const health = chips.flatMap((c) =>
			c.rows[entry.name] ? [{ ...c.rows[entry.name], source: c.source }] : [],
		);
		const rows = named.get(entry.name)?.rows ?? [];
		return { entry, rows, ...standingOf(entry, health, rows, sources, ctx) };
	});
}
