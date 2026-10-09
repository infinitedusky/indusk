/** One recorded run of a promise, as the health line names it. */
export interface Run {
	promise: string;
	source: string;
	outcome: "upheld" | "violated";
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

export function addRuns(a: Activity, _runs: Run[]): Activity {
	return a;
}

/** What the section says: one line per run, or that none has arrived. */
export function activityLines(_a: Activity): string[] {
	return [];
}
