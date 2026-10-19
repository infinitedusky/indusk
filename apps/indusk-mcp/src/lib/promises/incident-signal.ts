import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { commandTracer, flushCommandTracer } from "../telemetry/command-tracer.js";
import { markPromise } from "./mark.js";
import { INCIDENTS_SUBDIR } from "./vocabulary.js";

/**
 * The signal of `a-break-names-its-clause` (mark-first ADR D1): read from the
 * incident a clause's break opened. Upheld when the incident names
 * `promise/clause` (its frontmatter and its Signal line); broken, reporting
 * what it names instead, when it names only the promise. One verdict per
 * incident that came from a break naming a clause; a break that named none
 * has no clause to name and writes nothing.
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/a-break-names-its-clause
 */

export const NAMES_PROMISE = "a-clause-is-proved-twice";
export const NAMES_CLAUSE = "a-break-names-its-clause";
const SIGNAL = { plan: "mark-first", phase: "Build Phase 5" };

export interface IncidentVerdict {
	outcome: "upheld" | "broken";
	symptom?: string;
}

/**
 * What the incident file at `<registry dir>/incidents/<id>.md` says of the
 * clause its break named, or null when the file cannot be read.
 */
export function incidentVerdict(
	planRoot: string,
	id: string,
	promise: string,
	clause: string,
): IncidentVerdict | null {
	const path = join(planRoot, ".indusk", "promises", INCIDENTS_SUBDIR, `${id}.md`);
	if (!existsSync(path)) return null;
	const parsed = matter(readFileSync(path, "utf-8"));
	const named = parsed.data.clause === clause && parsed.content.includes(`${promise}/${clause}`);
	return named
		? { outcome: "upheld" }
		: {
				outcome: "broken",
				symptom: `incident ${id} was opened from a break of ${promise}/${clause} and names ${
					parsed.data.clause ? `only the clause ${String(parsed.data.clause)}` : "only the promise"
				}`,
			};
}

/** Write the verdict through the commands' tracer; best-effort, never failing a pass. */
export async function markIncidentVerdict(verdict: IncidentVerdict): Promise<void> {
	try {
		const span = commandTracer().startSpan("promises.record.incident");
		markPromise(span, {
			promise: NAMES_PROMISE,
			clause: NAMES_CLAUSE,
			outcome: verdict.outcome,
			signal: SIGNAL,
			...(verdict.symptom ? { symptom: verdict.symptom } : {}),
		});
		span.end();
		await flushCommandTracer();
	} catch {
		// A signal is best-effort: writing it must never fail the pass.
	}
}
