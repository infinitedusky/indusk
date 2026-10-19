import type { ClauseReport } from "./clause-standing.js";
import type { PromiseEntry } from "./registry.js";

/** One test file's verdict from a run made now. */
export interface TestFileResult {
	file: string;
	passed: boolean;
}

/** Runs test files (paths as the rows name them) and gives each its verdict. */
export type ClauseTestRunner = (files: string[]) => Promise<TestFileResult[]>;

/** What the daemon says of a promise's clauses, or why it could not be asked. */
export type ClauseReports =
	| { ok: true; byClause: Record<string, ClauseReport[]>; heartbeatOk: boolean }
	| { ok: false; reason: string };

/** Asks the daemon what each clause of a promise has reported. */
export type SignalReader = (promise: PromiseEntry) => Promise<ClauseReports>;
