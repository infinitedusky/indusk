import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { isUsableRelPath } from "../path-segment.js";
import type { TestFileResult } from "../promises/clause-proof.js";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";
import { clauseTokenPattern } from "../tokens.js";

/**
 * The landing's report of `recorder-waits-for-its-break`: when the clause tests
 * `plans land` ran include a file carrying the clause's token, the clause reports
 * upheld for a pass and broken, naming the landing and the file, for a failure.
 * `plans land` is a real command run, so its span is kept (a test run's is dropped).
 * Between the landings whose tests include the recorder test the clause has no
 * signal, which is the honest reading.
 *
 * promise: landing-tests-hold-under-load
 * clause: landing-tests-hold-under-load/recorder-waits-for-its-break
 */

const PROMISE = "landing-tests-hold-under-load";
const CLAUSE = "recorder-waits-for-its-break";
const SIGNAL = { plan: "a-run-can-be-trusted", phase: "Build Phase 6" };

/** Whether the file (as a row names it, under `codeRoot`) carries the clause's token. */
function carriesClause(codeRoot: string, rel: string): boolean {
	const abs = join(codeRoot, rel);
	if (!isUsableRelPath(rel) || !existsSync(abs) || !statSync(abs).isFile()) return false;
	return clauseTokenPattern(PROMISE, CLAUSE).test(readFileSync(abs, "utf-8"));
}

export async function markRecorderClause(
	projectRoot: string,
	codeRoot: string,
	plan: string,
	results: readonly TestFileResult[],
	tracer?: Tracer,
): Promise<void> {
	const verdicts: ClauseVerdict[] = results
		.filter((r) => carriesClause(codeRoot, r.file))
		.map((r) => ({
			promise: PROMISE,
			clause: CLAUSE,
			...(r.passed
				? {}
				: {
						broken: `landing ${plan}: ${r.file} ${r.reason ?? "failed when run at landing"}`.slice(
							0,
							500,
						),
					}),
		}));
	if (verdicts.length === 0) return;
	await writeClauseSignals(projectRoot, "plans.land", plan, SIGNAL, verdicts.slice(0, 1), tracer);
}
