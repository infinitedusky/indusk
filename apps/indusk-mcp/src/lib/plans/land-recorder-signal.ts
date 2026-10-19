import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { isUsableRelPath } from "../path-segment.js";
import type { TestFileResult } from "../promises/clause-proof.js";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";
import { clauseTokenPattern } from "../tokens.js";

/**
 * The landing's report of `recorder-waits-for-its-break`: when the clause tests
 * `plans land` ran include the recorder landing test (`RECORDER_LANDING_TEST`, carrying the
 * clause's token), the clause reports upheld for its pass and broken, naming the landing and
 * the file, for its failure; with no such result it reports nothing.
 * `plans land` is a real command run, so its span is kept (a test run's is dropped).
 * Between the landings whose tests include the recorder test the clause has no
 * signal, which is the honest reading.
 *
 * promise: landing-tests-hold-under-load
 * clause: landing-tests-hold-under-load/recorder-waits-for-its-break
 */

const PROMISE = "landing-tests-hold-under-load";
const CLAUSE = "recorder-waits-for-its-break";
/**
 * The landing test that waits under load (the one `vitest.tiers.ts` `SYSTEM` lists for this
 * clause), as a row names it relative to its package. Only its result speaks for the clause:
 * the unit files carry the token too, and their passing says nothing of a wait under load (A103).
 */
export const RECORDER_LANDING_TEST = "src/__tests__/admin-recorder.test.ts";

const isRecorderLandingTest = (file: string): boolean => {
	const f = file.replace(/\\/g, "/");
	return f === RECORDER_LANDING_TEST || f.endsWith(`/${RECORDER_LANDING_TEST}`);
};
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
	const carrying = results.filter(
		(r) => isRecorderLandingTest(r.file) && carriesClause(codeRoot, r.file),
	);
	// One report per landing: a failure of the recorder landing test (run twice, say) breaks it.
	const result = carrying.find((r) => !r.passed) ?? carrying[0];
	if (result === undefined) return;
	const verdict: ClauseVerdict = {
		promise: PROMISE,
		clause: CLAUSE,
		...(result.passed
			? {}
			: {
					broken:
						`landing ${plan}: ${result.file} ${result.reason ?? "failed when run at landing"}`.slice(
							0,
							500,
						),
				}),
	};
	await writeClauseSignals(projectRoot, "plans.land", plan, SIGNAL, [verdict], tracer);
}
