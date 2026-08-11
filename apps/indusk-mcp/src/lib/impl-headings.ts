/**
 * The one definition of every heading an impl document uses.
 *
 * Before this module the phase-heading pattern existed in six places across
 * five files, with no test holding them together. That was survivable while
 * there was one kind of phase. It stops being survivable the moment there are
 * two: a second kind added to five copies is a plan that fails four times
 * before it works, and each failure is silent — an unrecognised heading does
 * not error, it simply isn't a phase, and every rule keyed on phases quietly
 * has nothing to say.
 *
 * `impl-headings.test.ts` asserts by counting: exactly one definition under
 * `src/`. It is the same structural shape as `shared-resolution.test.ts`, and
 * for the same reason — no behavioural test can catch a divergence that has
 * not happened yet.
 *
 * The JS hooks cannot import a `.ts` module and mirror these constants inline
 * with a deliberate-port comment, the way the trajectory hooks already do.
 * Change this file and every port together.
 */

/**
 * A build phase: `### Phase 1: Name` or `### Build Phase 1: Name`.
 *
 * The `Build ` group is optional, which is the whole backward-compatibility
 * story — every impl written before test phases existed keeps parsing, so no
 * archived plan needs editing and no reader needs to learn that two spellings
 * mean the same thing before they can read old work.
 *
 * Capture 1 is the number, capture 2 the name.
 */
export const PHASE_HEADING = /^###\s+(?:Build\s+)?Phase\s+(\d+)[:\s]+(.*)/;

/**
 * A test phase: `### Test Phase 1: Name`.
 *
 * Deliberately a separate pattern rather than another optional group in
 * `PHASE_HEADING`. The two kinds must never be confusable by a regex that
 * "helpfully" matches both — a test phase counted as a build phase would
 * satisfy the very rules it exists to make checkable.
 *
 * Capture 1 is the number, capture 2 the name.
 */
export const TEST_PHASE_HEADING = /^###\s+Test\s+Phase\s+(\d+)[:\s]+(.*)/;

/**
 * The number-only form, for callers that need to recognise a phase heading
 * without caring which kind it is — anything scanning for "where does this
 * phase end" wants both, because a test phase ends a build phase just as
 * surely as another build phase does.
 */
export const ANY_PHASE_HEADING = /^###\s+(?:Test\s+|Build\s+)?Phase\s+(\d+)\b/;

/** Gate kinds an impl phase can carry. */
export type GateKind = "Verification" | "OTel" | "Context" | "Document";

/**
 * A gate heading: `#### Phase 1 Verification`, `#### Build Phase 1 Context`,
 * `#### Test Phase 1 Verification`.
 *
 * **Capture 1 is always the phase number.** `kind` may be a single kind or an
 * alternation like `(Verification|Context|Document)`, in which case its own
 * group lands at capture 2 — group numbering is worth stating because it is
 * the one thing a caller can get silently wrong here, and a gate type read
 * from the wrong index is an undefined lookup rather than a crash.
 */
export function gateHeading(kind: GateKind | string): RegExp {
	return new RegExp(`^####\\s+(?:Test\\s+|Build\\s+)?Phase\\s+(\\d+)\\s+${kind}\\b`);
}

/** `#### Phase N Forward Intelligence`, in any phase-kind spelling. */
export const FORWARD_INTELLIGENCE_HEADING =
	/^####\s+(?:Test\s+|Build\s+)?Phase\s+\d+\s+Forward Intelligence\b/;

/** Which kind of phase a heading declares. */
export type PhaseKind = "build" | "test";

export interface ParsedPhaseHeading {
	kind: PhaseKind;
	number: number;
	name: string;
}

/**
 * Parse a line as a phase heading, or `null` if it is not one.
 *
 * Test phases are tried first: `PHASE_HEADING` does not match `### Test Phase
 * 1` today, but the ordering makes that a property of this function rather
 * than a property of a regex someone might later loosen.
 */
export function parsePhaseHeading(line: string): ParsedPhaseHeading | null {
	const test = TEST_PHASE_HEADING.exec(line);
	if (test) {
		return { kind: "test", number: Number.parseInt(test[1], 10), name: test[2].trim() };
	}
	const build = PHASE_HEADING.exec(line);
	if (build) {
		return { kind: "build", number: Number.parseInt(build[1], 10), name: build[2].trim() };
	}
	return null;
}
