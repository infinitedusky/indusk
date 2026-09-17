import { type PhaseAddress, type PhaseKind, toPhaseRef } from "../impl-headings.js";

/**
 * The phase-boundary record and the two pure questions asked of it — no
 * filesystem, so the admin's browser components can import them (the browser
 * runtime externalizes `node:fs`). `boundary.ts` re-exports this and adds the
 * read and write.
 */

export interface PhaseBoundaryRecord {
	plan: string;
	phase: number;
	/**
	 * Which sequence `phase` numbers. **Absent means `build`** — every record
	 * written before admin-ui-phase-progress was a build phase, because Shape
	 * could not open a test phase then. A rule the reader states, not a
	 * migration: no file is rewritten.
	 */
	kind?: PhaseKind;
	/** The commit the phase opened at. */
	sha: string;
	timestamp: string;
}

/**
 * Where phase N of this plan began. Null when the phase was never opened —
 * callers must treat that as "cannot scope the review", never as "review
 * everything".
 *
 * The **earliest** record wins when a file already carries duplicates (written
 * before `recordPhaseStart` became idempotent, or merged from two branches). A
 * phase begins once; a resume is not a new beginning. Erring earlier makes the
 * review scope too wide, which costs a re-read — erring later makes it too
 * narrow, which loses work silently. Only one of those is recoverable.
 */
export function findPhaseStart(
	records: PhaseBoundaryRecord[],
	plan: string,
	phase: PhaseAddress,
): PhaseBoundaryRecord | null {
	for (const record of records) {
		if (record.plan === plan && boundaryMatches(record, phase)) return record;
	}
	return null;
}

/**
 * Does this record open the phase `phase` names? The one place the
 * absent-kind rule is applied: a record without `kind` is a build record.
 * Exported so a reader that already holds a plan's records (the admin's
 * active-phase derivation) applies the same rule rather than restating it.
 */
export function boundaryMatches(record: PhaseBoundaryRecord, phase: PhaseAddress): boolean {
	const ref = toPhaseRef(phase);
	return record.phase === ref.number && (record.kind ?? "build") === ref.kind;
}
