// promise: the-editor-shows-each-run-as-it-happens
/** One recorded run of a promise, as the health line names it. */
export interface Run {
	promise: string;
	source: string;
	/** The CLI says `broken`; `violated` is the word signals carried before 2026-10-15, read the same (copied from the package's `readOutcome`, which the extension does not import). */
	outcome: "upheld" | "broken" | "violated";
	at: string;
	traceId: string;
}

export interface Activity {
	/** Newest first. */
	runs: Run[];
	seen: Set<string>;
}

export const ACTIVITY_MAX = 200;

/**
 * The panel's activity section (vscode-extension ADR decision 8): each run
 * added once, as it arrives, newest first, at most `ACTIVITY_MAX`.
 */
export function startActivity(): Activity {
	return { runs: [], seen: new Set() };
}

export function addRuns(a: Activity, runs: Run[]): Activity {
	const fresh = runs.filter((r) => !a.seen.has(keyOf(r)));
	if (fresh.length === 0) return a;
	const kept = [...fresh, ...a.runs]
		.sort((x, y) => y.at.localeCompare(x.at) || x.traceId.localeCompare(y.traceId))
		.slice(0, ACTIVITY_MAX);
	// Forget what fell off the end, so `seen` stays as bounded as the list.
	return { runs: kept, seen: new Set(kept.map(keyOf)) };
}

/** One run's identity: the same run is named the same way on every line (A26). */
function keyOf(r: Run): string {
	return `${r.source}\0${r.traceId}\0${r.at}\0${r.outcome}`;
}

/** What the section says: one line per run, or that none has arrived. */
export function activityLines(
	a: Activity,
	time: (iso: string) => string = (iso) => `${iso.slice(11, 19)} UTC`,
	/** A promise's words from the health line; the handle when not given. */
	titleOf: (promise: string) => string = (promise) => promise,
): string[] {
	if (a.runs.length === 0) return ["No runs yet."];
	return a.runs.map(
		(r) =>
			`${titleOf(r.promise)} ${r.outcome === "upheld" ? "held" : "broke"} (${r.source}) · ${time(r.at)}`,
	);
}
