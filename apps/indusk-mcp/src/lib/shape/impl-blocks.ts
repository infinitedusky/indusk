import { buildPhaseHeadingFor, gateHeadingFor } from "../impl-headings.js";

/**
 * How markdown headings delimit a phase's blocks in an impl.md.
 *
 * One definition, because two callers want the same walk from different
 * starting headings: appending an item starts at `### Phase N`, reading the
 * verification gate starts at `#### Phase N Verification`. When each carried
 * its own copy they agreed by coincidence — and a fix to one would have skipped
 * the other silently, which is the class of bug a structural test exists to
 * make impossible rather than merely unlikely.
 */

/**
 * Any markdown heading from `##` to `####`.
 *
 * This is what ends a block. Deliberately not just the gate headings: a phase's
 * implementation items are also ended by the next `### Phase`, and by a
 * top-level `## Files Affected` when the phase is the last one.
 */
const HEADING = /^#{2,4}\s/;

/** Index of the first line matching `pattern`, or -1. */
export function findHeadingIndex(lines: string[], pattern: RegExp): number {
	return lines.findIndex((line) => pattern.test(line));
}

/**
 * The `### Phase N` heading matcher, for one specific phase.
 *
 * Re-exported from `lib/impl-headings.ts` rather than built here. It *was*
 * built here, as its own template string, and the escaped-in-a-template form
 * slipped past the single-definition guard — so it kept matching `### Phase N`
 * alone while `/planner` started emitting `### Build Phase N`, and Shape
 * silently found no phase at all in every newly-authored impl.
 *
 * Note it deliberately does not match `### Test Phase N`: a test phase writes
 * tests, not the code Shape reviews, and matching it would land a finding in
 * the other sequence's phase N.
 */
export const phaseHeading = buildPhaseHeadingFor;

/** The `#### Phase N <Gate>` heading matcher, for one specific phase. */
export const gateHeading = gateHeadingFor;

/**
 * Where the block under the heading at `headingAt` ends — the index of the next
 * heading, or the end of the document.
 */
export function blockEnd(lines: string[], headingAt: number): number {
	for (let i = headingAt + 1; i < lines.length; i++) {
		if (HEADING.test(lines[i])) return i;
	}
	return lines.length;
}

/** The lines of the block under the heading at `headingAt`, headings excluded. */
export function blockLines(lines: string[], headingAt: number): string[] {
	return lines.slice(headingAt + 1, blockEnd(lines, headingAt));
}
