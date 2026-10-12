import { type ApprovalEntry, approvalOf, readApprovals } from "../looks/approvals.js";
import { lookDevice, schemesOf } from "../looks/check.js";
import { type Coverage, coverageOf } from "../looks/coverage.js";
import { type LooksApp, readApp } from "../looks/mockups.js";
import { listApps } from "../looks/overview.js";
import { LOOK_PROMISE } from "../looks/report.js";
import { daemonStatus } from "../telemetry/status.js";
import { markProjectId } from "./config.js";
import { jaegerEndpoint, jaegerGet, marksBetween } from "./telemetry.js";

/**
 * Where a look stands beside the promises (ui-promises ADR decision 7): the
 * word the dashboard, the Looks page and the editor share, read from the
 * approvals, the coverage and the look check's recorded runs. It lives beside
 * `promises/standing`, which re-exports it — the subpath is unchanged.
 *
 * promise: a-look-reports-like-any-promise
 */

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
	/** `story` for a component story's run; absent for a screen's, so no recorded run needs rewriting. */
	kind?: "story";
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
 * The newest run for one look at one device, no older than `since` (the
 * approval in force; null when none is). A check against an earlier reference
 * says nothing about this one. Only a run of the look's own kind counts: a
 * story's run shares a screen's app, name, state and device (`nav.expanded`),
 * and a run without a kind is a screen's.
 */
export function newestRunSince(
	runs: readonly LookRun[],
	key: {
		app: string;
		screen: string;
		state: string;
		device: string | null;
		since: string | null;
		kind?: "story";
	},
): LookRun | null {
	return runs
		.filter(
			(r) =>
				r.app === key.app &&
				r.screen === key.screen &&
				r.state === key.state &&
				r.device === key.device &&
				(r.kind ?? "screen") === (key.kind ?? "screen") &&
				(key.since === null || r.at >= key.since),
		)
		.reduce<LookRun | null>((a, r) => (a === null || r.at > a.at ? r : a), null);
}

/**
 * The look rule: broken when its newest counted run broke — the app is held to
 * the last approved version even while a change waits — else uncovered until
 * its mockup is approved as it is, else held or, with no run, unchecked.
 */
export function lookStandingFor(approved: boolean, newest: LookRun | null): LookStanding {
	if (newest?.outcome === "violated") return "broken";
	if (!approved) return "uncovered";
	return newest ? "held" : "unchecked";
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
	// A look is at a device in each scheme the foundation names (`phone`, `phone/dark`):
	// a scheme not yet opened reads not checked, never held.
	const devices =
		app.devices.length > 0
			? app.devices.flatMap((d) => schemesOf(app).map((scheme) => lookDevice(d.name, scheme)))
			: [null];
	for (const screen of app.screens) {
		for (const state of screen.states) {
			const look = `${screen.name}.${state}`;
			const mockup = app.mockups.find((m) => m.name === look);
			const approval = mockup ? approvalOf(app, mockup, approvals) : null;
			const since = approval?.state === "approved" ? approval.entry.at : null;
			for (const device of devices) {
				const newest = newestRunSince(runs, {
					app: app.app,
					screen: screen.name,
					state,
					device,
					since,
				});
				const standing = lookStandingFor(approval?.state === "approved", newest);
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
	// A name decided at run time is listed by where it is, uncovered like a name no mockup shows.
	for (const component of [
		...coverage.components,
		...coverage.unresolved.map((at) => `unresolved ${at}`),
	]) {
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
