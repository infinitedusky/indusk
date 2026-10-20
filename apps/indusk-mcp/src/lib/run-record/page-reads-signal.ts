import type { Tracer } from "@opentelemetry/api";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";

/**
 * The signal for the three clauses of `admin-pages-load-fast` (decisions 8, 14, 15, 21): each page
 * load reports how many process-list and landing reads it made, how many programs it started,
 * whether a read was made early and how old the readings it used were, how long the event loop
 * was blocked and how long the page took. The admin has no tracer of its own, so this goes through
 * the commands' clause-signal writer, filed under this plan, never raising.
 *
 * signal: admin-pages-load-fast/one-read-per-page — program starts and read counts per page
 * signal: admin-pages-load-fast/kept-briefly — early refreshes and reading ages
 * signal: admin-pages-load-fast/never-freezes — blocked event loop and elapsed page time
 */

const PROMISE = "admin-pages-load-fast";
const SIGNAL = { plan: "admin-pages-load-fast", phase: "Build Phase 1" };

/** Program starts a page may make for each repository it reads, whatever the plan count. */
export const PAGE_STARTS_LIMIT = 6;
/** The longest the event loop may be held by one page's reads. */
export const BLOCKED_LIMIT_MS = 100;
/** A page answers within this. */
export const PAGE_LIMIT_MS = 1000;
/** An upheld report for one page is written at most this often; a broken one always is. */
export const UPHELD_EVERY_MS = 15_000;

export interface PageReadsInput {
	/** The page, as a person names it ("plan", "promises", "looks"). */
	page: string;
	plans: number;
	processReads: number;
	landingReads: number;
	programStarts: number;
	/** Repositories the page read; the starts bound is `PAGE_STARTS_LIMIT` for each. */
	repositories: number;
	/** For each fresh read the page made, whether the previous one was still inside its window. */
	refreshedEarly: readonly boolean[];
	/** The age and window of each reading the page used. */
	readings: ReadonlyArray<{ ageMs: number; windowMs: number }>;
	maxBlockedMs: number;
	/** From the top of the page function to the end of its reads. */
	elapsedMs: number;
}

/** The three clauses' verdicts for one page load. */
export function judgePageReads(input: PageReadsInput): ClauseVerdict[] {
	const base = (clause: string): ClauseVerdict => ({ promise: PROMISE, clause });
	const bound = PAGE_STARTS_LIMIT * Math.max(1, input.repositories);
	const verdicts: ClauseVerdict[] = [];

	const reads = input.processReads > 1 || input.landingReads > 1;
	const starts = input.programStarts > bound;
	verdicts.push({
		...base("one-read-per-page"),
		...(reads || starts
			? {
					broken: `${input.page} page read the process list ${input.processReads} times and the landing history ${input.landingReads} times and started ${input.programStarts} programs for ${input.plans} plans (at most ${bound}, whatever the plan count)`,
				}
			: {}),
	});

	const early = input.refreshedEarly.some(Boolean);
	const stale = input.readings.find((r) => r.ageMs > r.windowMs);
	verdicts.push({
		...base("kept-briefly"),
		...(early || stale
			? {
					broken: early
						? `${input.page} page read fresh although the last reading was still inside its window`
						: `${input.page} page used a reading ${stale?.ageMs} ms old past its ${stale?.windowMs} ms window`,
				}
			: {}),
	});

	const blocked = input.maxBlockedMs > BLOCKED_LIMIT_MS;
	const slow = input.elapsedMs > PAGE_LIMIT_MS;
	verdicts.push({
		...base("never-freezes"),
		...(blocked || slow
			? {
					broken: `${input.page} page took elapsed ${Math.round(input.elapsedMs)} ms, event loop blocked ${Math.round(input.maxBlockedMs)} ms (limits ${PAGE_LIMIT_MS} and ${BLOCKED_LIMIT_MS})`,
				}
			: {}),
	});
	return verdicts;
}

const upheldSentAt = new Map<string, number>();

export interface ReportDeps {
	tracer?: Tracer;
	now?: () => number;
}

/**
 * Judge the page and write each verdict. A broken verdict is always written; an upheld one is
 * written at most once per root and page in `UPHELD_EVERY_MS`, since a page refreshes every few
 * seconds. Best-effort: it never raises.
 */
export async function reportPageReads(
	root: string,
	input: PageReadsInput,
	deps: ReportDeps = {},
): Promise<void> {
	try {
		const now = (deps.now ?? Date.now)();
		const verdicts = judgePageReads(input);
		const anyBroken = verdicts.some((v) => v.broken !== undefined);
		const key = `${root}\0${input.page}`;
		if (!anyBroken) {
			if (now - (upheldSentAt.get(key) ?? Number.NEGATIVE_INFINITY) < UPHELD_EVERY_MS) return;
			upheldSentAt.set(key, now);
		}
		await writeClauseSignals(root, "admin.page-reads", PROMISE, SIGNAL, verdicts, deps.tracer);
	} catch {
		// A signal is best-effort: it must never reach the page.
	}
}
