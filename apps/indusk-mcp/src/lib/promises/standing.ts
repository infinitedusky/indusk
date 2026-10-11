import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { type ApprovalEntry, approvalOf, readApprovals } from "../looks/approvals.js";
import { type Coverage, coverageOf } from "../looks/coverage.js";
import { type LooksApp, readApp } from "../looks/mockups.js";
import { listApps } from "../looks/overview.js";
import { LOOK_PROMISE } from "../looks/report.js";
import { daemonStatus } from "../telemetry/status.js";
import { markProjectId } from "./config.js";
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
import { jaegerEndpoint, jaegerGet, marksBetween } from "./telemetry.js";

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
 * The dashboard's "held N · broke M of 30 days": both count days — `broke` the
 * days with a violation heard (five on one day are one), `held` the rest of
 * the thirty — so they add to thirty; null while the promise has never been
 * seen or heard (nothing was held, nothing watched).
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
			broke: brokenDays,
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

// -- looks (ui-promises ADR decision 7) ---------------------------------------

/**
 * Where a look stands — one screen in one state at one reference device, or a
 * component the app renders — beside the promises: `broken` when its newest
 * check broke, `held` when it held, `unchecked` when its mockup is approved
 * and no check has run since, `uncovered` when no approved mockup covers it.
 * Uncovered is never held: a held check against an old reference still reads
 * uncovered until a person approves the mockup as it is.
 */
export type LookStanding = "broken" | "held" | "unchecked" | "uncovered";

/** A look's standing in words: the admin and the editor show the same word. */
export const LOOK_WORDS: Readonly<Record<LookStanding, string>> = {
	broken: "broken",
	held: "held",
	unchecked: "not checked",
	uncovered: "uncovered",
};

/** One recorded run of the look check, as its span said. */
export interface LookRun {
	app: string;
	screen: string;
	state: string;
	device: string;
	outcome: "upheld" | "violated";
	/** When the run ended, ISO. */
	at: string;
	symptom: string | null;
}

export interface LookRow {
	app: string;
	/** `<screen>.<state>`, or a component's name. */
	look: string;
	kind: "screen" | "component";
	/** The reference device; null for a component, or an app that declares none. */
	device: string | null;
	standing: LookStanding;
	word: string;
	/** The newest counted run, ISO; null when none. */
	at: string | null;
	/** What the newest broken run saw. */
	symptom: string | null;
}

export interface LookStandingRead {
	/** Broken first, then as the app declares its screens, states and devices. */
	rows: LookRow[];
	/** An app whose looks could not be read, named; its neighbours are still read. */
	problems: { app: string; problem: string }[];
	/** Whether the runs were read; when not, approved looks read unchecked and `where` says why. */
	runs: { ok: true } | { ok: false; where: string };
}

/**
 * Each look of one app with its standing, from the facts the `looks/` modules
 * give: whether each declared screen state's mockup is approved as it is
 * (`approvalOf`), what the app renders that no approved mockup shows
 * (`coverage.components`), and the recorded runs. A run counts only when it
 * is no older than the approval in force — a check against an earlier
 * reference says nothing about this one.
 */
export function lookStandingOf(
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
	coverage: Coverage,
	runs: readonly LookRun[],
): LookRow[] {
	const rows: LookRow[] = [];
	const devices = app.devices.length > 0 ? app.devices.map((d) => d.name) : [null];
	for (const screen of app.screens) {
		for (const state of screen.states) {
			const look = `${screen.name}.${state}`;
			const mockup = app.mockups.find((m) => m.name === look);
			const approval = mockup ? approvalOf(app, mockup, approvals) : null;
			const since = approval?.state === "approved" ? approval.entry.at : null;
			for (const device of devices) {
				const newest = runs
					.filter(
						(r) =>
							r.app === app.app &&
							r.screen === screen.name &&
							r.state === state &&
							r.device === device &&
							(since === null || r.at >= since),
					)
					.reduce<LookRun | null>((a, r) => (a === null || r.at > a.at ? r : a), null);
				const standing: LookStanding =
					newest?.outcome === "violated"
						? "broken"
						: approval?.state !== "approved"
							? "uncovered"
							: newest
								? "held"
								: "unchecked";
				rows.push({
					app: app.app,
					look,
					kind: "screen",
					device,
					standing,
					word: LOOK_WORDS[standing],
					at: standing === "uncovered" ? null : (newest?.at ?? null),
					symptom: standing === "broken" ? (newest?.symptom ?? null) : null,
				});
			}
		}
	}
	for (const component of coverage.components) {
		rows.push({
			app: app.app,
			look: component,
			kind: "component",
			device: null,
			standing: "uncovered",
			word: LOOK_WORDS.uncovered,
			at: null,
			symptom: null,
		});
	}
	return rows;
}

/** Broken first; otherwise the order the apps declare. */
function brokenFirst(rows: LookRow[]): LookRow[] {
	return rows
		.map((row, i) => ({ row, i }))
		.sort(
			(a, b) =>
				Number(b.row.standing === "broken") - Number(a.row.standing === "broken") || a.i - b.i,
		)
		.map((x) => x.row);
}

export interface LookStandingDeps {
	/** The recorded runs; read from the local telemetry daemon's Jaeger by default. */
	runs?: LookRun[];
	/** How long a read is reused; the admin passes its refresh interval. */
	cacheMs?: number;
	now?: () => number;
	timeoutMs?: number;
}

/** How far back a look's runs are read: a week of landings and checks. */
const LOOK_WINDOW_MS = 7 * 86_400_000;
const LOOK_CACHE_MS = 5_000;
const lookCache = new Map<string, { expires: number; read: LookStandingRead }>();

/**
 * Every look of every app in the project (`.indusk/mockups/<app>/`), with its
 * standing — the one reader the dashboard, the nav's broken count and the
 * editor's line share. A project with no looks reads none and asks Jaeger
 * nothing. Never throws: an unreadable app is a problem beside the rest, and
 * runs that cannot be read leave every approved look unchecked, saying why.
 */
export async function readLookStanding(
	projectRoot: string,
	deps: LookStandingDeps = {},
): Promise<LookStandingRead> {
	const apps = listApps(projectRoot);
	if (apps.length === 0) return { rows: [], problems: [], runs: { ok: true } };
	const now = deps.now ?? Date.now;
	const cached = deps.runs ? undefined : lookCache.get(projectRoot);
	if (cached && cached.expires > now()) return cached.read;

	const runs: { list: LookRun[]; status: LookStandingRead["runs"] } = deps.runs
		? { list: deps.runs, status: { ok: true } }
		: await readLookRuns(projectRoot, {
				since: new Date(now() - LOOK_WINDOW_MS),
				timeoutMs: deps.timeoutMs ?? 2_000,
			});
	const rows: LookRow[] = [];
	const problems: LookStandingRead["problems"] = [];
	for (const name of apps) {
		try {
			const app = await readApp(projectRoot, name);
			const approvals = readApprovals(app);
			const coverage = await coverageOf(projectRoot, app, approvals);
			rows.push(...lookStandingOf(app, approvals, coverage, runs.list));
		} catch (err) {
			problems.push({ app: name, problem: (err as Error).message });
		}
	}
	const read: LookStandingRead = { rows: brokenFirst(rows), problems, runs: runs.status };
	if (!deps.runs) {
		lookCache.set(projectRoot, { expires: now() + (deps.cacheMs ?? LOOK_CACHE_MS), read });
	}
	return read;
}

/**
 * The look check's runs since `since`, from the local telemetry daemon — the
 * marks `looks/report` files under `tokens-are-held-exactly`, read with the
 * one marks query (`marksBetween`) and kept only when they name a look.
 */
export async function readLookRuns(
	projectRoot: string,
	opts: { since: Date; timeoutMs: number },
): Promise<{ list: LookRun[]; status: LookStandingRead["runs"] }> {
	try {
		const status = await daemonStatus();
		if (!status.running) {
			return { list: [], status: { ok: false, where: "no telemetry daemon is running" } };
		}
		const endpoint = jaegerEndpoint(`http://localhost:${status.uiPort}`);
		const services = await jaegerGet<string>(endpoint, "/api/services", opts.timeoutMs);
		const project = markProjectId(projectRoot);
		const seen = new Map<string, LookRun>();
		for (const service of services) {
			const { marks } = await marksBetween(endpoint, {
				service,
				name: LOOK_PROMISE,
				promise: LOOK_PROMISE,
				from: opts.since,
				to: new Date(),
				project,
				timeoutMs: opts.timeoutMs,
			});
			for (const m of marks) {
				if (!m.look) continue;
				seen.set(m.spanId, {
					...m.look,
					outcome: m.outcome,
					at: m.at.toISOString(),
					symptom: m.symptom,
				});
			}
		}
		return { list: [...seen.values()], status: { ok: true } };
	} catch (err) {
		return { list: [], status: { ok: false, where: (err as Error).message } };
	}
}
