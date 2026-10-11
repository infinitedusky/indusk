/**
 * Types for the context system evaluation.
 *
 * The scorecard is the unit of evaluation — one per commit. Questions are the
 * rubric, defined in rubric.ts and answered by the eval agent (evaluator).
 */

export interface RubricQuestion {
	id: string;
	question: string;
	guidance: string;
}

export interface EvalQuestion {
	id: string;
	question: string;
	answer: "yes" | "no" | "partial";
	severity: "info" | "warning" | "critical";
	evidence: string;
	finding: string;
}

export interface EvalUsage {
	costUsd: number;
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	durationMs: number;
}

export interface EvalScorecard {
	version: 1;
	timestamp: string;
	mode: "eval" | "baseline";
	changeId: string;
	projectGroup: string;
	questions: EvalQuestion[];
	summary: string;
	graphitiWrites: number;
	telemetryPosted: boolean;
	usage?: EvalUsage;
}

export interface EvalErrorEntry {
	version: 1;
	timestamp: string;
	mode: "eval" | "baseline";
	changeId: string;
	error: true;
	message: string;
}

/**
 * A commit the model refused to evaluate for a limit (evaluator-waits-out-limits).
 * Not an error: nothing is wrong with the commit, and a later commit's trigger
 * evaluates it. It is queued in the project's `eval/pending.jsonl`.
 */
export interface EvalWaitingEntry {
	version: 1;
	timestamp: string;
	mode: "eval" | "baseline";
	changeId: string;
	waiting: true;
	message: string;
}

export type EvalLogEntry = EvalScorecard | EvalErrorEntry | EvalWaitingEntry;

export function isScorecard(entry: EvalLogEntry): entry is EvalScorecard {
	return (
		!("error" in entry) &&
		!("waiting" in entry) &&
		"questions" in entry &&
		Array.isArray((entry as EvalScorecard).questions)
	);
}

export function isErrorEntry(entry: EvalLogEntry): entry is EvalErrorEntry {
	return "error" in entry && entry.error === true;
}

export function isWaitingEntry(entry: EvalLogEntry): entry is EvalWaitingEntry {
	return "waiting" in entry && entry.waiting === true;
}
