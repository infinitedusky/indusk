/**
 * The editor's line (vscode-extension): what `indusk promises health --json`
 * prints, built from the reads `readHealth` returns by the one state rule in
 * `health.ts`. Its own module because its format moves with the editor, the
 * rule with the admin; re-exported from `health.ts`, so the
 * `./promises/health` subpath is unchanged.
 */
import { type HealthNames, type PlanDates, planTitle, promiseWords } from "./display.js";
import {
	type HealthRun,
	healthOf,
	type PromiseHealth,
	RUNS_PER_LINE,
	ruleFor,
	type SourceHealthRead,
} from "./health.js";
import type { Registry } from "./registry.js";
import type { SourceName } from "./sources.js";
import type { LookRow, LookStandingRead } from "./standing.js";

/** One promise's row in a `promises health --json` line. */
export interface HealthLineRow {
	promise: string;
	state: PromiseHealth;
	lastSeen: string | null;
	violations: number | null;
	symptom?: string;
	traceId?: string;
	/**
	 * ISO time of the newest violation — what "last broke" shows — apart from
	 * `lastSeen` (the newest run of any outcome).
	 *
	 * promise: a-broken-promise-says-when-it-last-broke
	 */
	lastBroke?: string;
	environment?: string | null;
	tests: string[];
}

/**
 * One run on the line, with the source that recorded it. `outcome` is the
 * wire word: a break is `violated` this release, because an editor installed
 * before it reads `r.outcome === "violated" ? "broke" : "held"` and is not
 * updated with the package. It moves to `broken` when every writer does
 * (`.indusk/planning/mark-first/`).
 *
 * promise: a-promise-is-upheld-or-broken
 */
export interface HealthLineRun extends Omit<HealthRun, "outcome"> {
	outcome: "upheld" | "violated";
	source: SourceName;
}

/** The newest runs of every promise in a store read, newest first. */
export function newestRuns(
	marks: Map<string, { at: string; outcome: string; traceId: string }[]>,
): HealthRun[] {
	return [...marks]
		.flatMap(([promise, list]) =>
			list.map((m) => ({
				promise,
				outcome: m.outcome as HealthRun["outcome"],
				at: m.at,
				traceId: m.traceId,
			})),
		)
		.sort(newestFirst)
		.slice(0, RUNS_PER_LINE);
}

function newestFirst(
	a: { at: string; traceId: string; source?: string },
	b: { at: string; traceId: string; source?: string },
): number {
	return (
		b.at.localeCompare(a.at) ||
		(a.source ?? "").localeCompare(b.source ?? "") ||
		a.traceId.localeCompare(b.traceId)
	);
}

/** One line of `indusk promises health --json`: every source's state for every promise, or why a source has none. */
export interface HealthLine {
	at: string;
	/**
	 * Every promise the project has, so a window can name one at its token and
	 * on hover without reading the registry itself — state and structure
	 * promises too, which have no row below (telemetry does not watch them).
	 */
	promises: {
		name: string;
		kind: string;
		statement: string;
		tests: string[];
		sites: string[];
		/** The plan that owns the promise. */
		plan: string;
		/** The handle in words (`promises/display`), so a window never turns one into words itself. */
		title: string;
		/** The owning plan's brief title, or its folder when it has none. */
		planTitle: string;
		/** When the owning plan started, landed and shipped. */
		planDates: PlanDates;
	}[];
	sources: (
		| { name: SourceName; label: string; ok: true; rows: HealthLineRow[] }
		| { name: SourceName; label: string; ok: false; reason: string; blind?: true }
	)[];
	/** The newest recorded runs across sources, newest first, at most `RUNS_PER_LINE`. */
	runs: HealthLineRun[];
	/**
	 * Each look's standing, as `promises/standing`'s `readLookStanding` gave it
	 * to the admin (ui-promises A24); absent when the project has no looks.
	 */
	looks?: LookRow[];
}

/**
 * The line `promises health --json` prints, built from the reads `readHealth`
 * returns, by the same rule the admin's chips use — the editor reads this, so
 * it cannot disagree with the admin (vscode-extension A6).
 */
export function healthLine(
	registry: Registry,
	reads: SourceHealthRead[],
	now: Date,
	names?: HealthNames,
	looks?: LookStandingRead,
): HealthLine {
	return {
		...(looks && looks.rows.length > 0 ? { looks: looks.rows } : {}),
		at: now.toISOString(),
		promises: registry.promises
			.filter((p) => p.state !== "retired")
			.map((p) => ({
				name: p.name,
				kind: p.kind,
				statement: p.statement,
				tests: p.tests ?? [],
				sites: p.sites ?? [],
				plan: p.owner,
				title: promiseWords(p.name, names?.words),
				planTitle: names?.planTitles[p.owner] ?? planTitle(undefined, p.owner, names?.words),
				planDates: names?.planDates[p.owner] ?? { started: null, landed: null, released: null },
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
						? {
								traceId: newestViolation.traceId,
								lastBroke: newestViolation.at.toISOString(),
								environment: newestViolation.environment ?? null,
							}
						: {}),
					tests: p.tests ?? [],
				});
			}
			return { name: read.name, label: read.label, ok: true as const, rows };
		}),
		runs: reads
			.flatMap((read) =>
				read.ok
					? (read.runs ?? []).map((r) => ({
							...r,
							outcome: r.outcome === "upheld" ? ("upheld" as const) : ("violated" as const),
							source: read.name,
						}))
					: [],
			)
			.sort(newestFirst)
			.slice(0, RUNS_PER_LINE),
	};
}
