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

/** A reference to a phase, as a trajectory cell or a heading names one. */
export interface PhaseRef {
	kind: PhaseKind;
	number: number;
}

/**
 * A trajectory cell naming a phase: `Phase 3`, `Build Phase 3`, `Test Phase 1`.
 *
 * Anchored and whole-cell, like the pattern it replaces — a cell with prose
 * around a phase name is not a reference, it is a malformed cell, and the
 * validator has a specific error for that.
 */
export const PHASE_REFERENCE = /^\s*(Test\s+|Build\s+)?Phase\s+(\d+)\s*$/i;

/** Parse a `Writable at` / `Passes at` cell. `null` if it is not a reference. */
export function parsePhaseRef(cell: string): PhaseRef | null {
	const match = PHASE_REFERENCE.exec(cell);
	if (!match) return null;
	const kind: PhaseKind = match[1]?.trim().toLowerCase() === "test" ? "test" : "build";
	return { kind, number: Number.parseInt(match[2], 10) };
}

/** True for a line that opens or closes a fenced code block. */
const FENCE = /^\s*(?:```|~~~)/;

/**
 * Mark every line that sits inside a fenced code block.
 *
 * Structure-scanning must skip these. A deferral entry in Test Phase 1 may
 * carry the deferred test's body, and that body will contain lines that look
 * exactly like checklist items and gate headings — which is the point of
 * carrying it. A parser that reads them as structure turns a piece of evidence
 * into a phantom phase.
 */
export function fencedLineMask(lines: string[]): boolean[] {
	const mask: boolean[] = [];
	let inFence = false;
	for (const line of lines) {
		if (FENCE.test(line)) {
			// The fence markers themselves count as inside: neither is structure.
			mask.push(true);
			inFence = !inFence;
			continue;
		}
		mask.push(inFence);
	}
	return mask;
}

/** The document's phases, in the order they appear. Fenced blocks ignored. */
export function phaseSequence(body: string): PhaseRef[] {
	const lines = body.split("\n");
	const fenced = fencedLineMask(lines);
	const out: PhaseRef[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const heading = parsePhaseHeading(lines[i]);
		if (heading) out.push({ kind: heading.kind, number: heading.number });
	}
	return out;
}

/**
 * Where `ref` sits on the document's single phase timeline.
 *
 * Two sequences that number independently cannot be ordered by number alone —
 * Test Phase 1 and Build Phase 1 are different phases wearing the same digit.
 * Document order is the only thing that orders them, because it is the order
 * the work actually happens in.
 *
 * **A document with no test phase reduces to the phase number**, exactly as
 * before. That is deliberate and load-bearing: every impl written before test
 * phases existed compares precisely as it always did, so backward
 * compatibility is a property of this function rather than a claim made about
 * it elsewhere. It also keeps `Phase 0` meaningful — it orders before `Phase 1`
 * by arithmetic, with no special case.
 *
 * A ref naming a phase the document does not contain is placed among phases of
 * its own kind by number, half a step past the last one smaller than it.
 * Trajectory rows legitimately name phases before those phases are written, and
 * a reference to the future should sort into the future rather than collapse to
 * zero.
 */
export function phaseOrdinal(ref: PhaseRef, sequence: readonly PhaseRef[]): number {
	if (!sequence.some((p) => p.kind === "test")) return ref.number;

	const exact = sequence.findIndex((p) => p.kind === ref.kind && p.number === ref.number);
	if (exact !== -1) return exact;

	let lastBefore = -1;
	for (let i = 0; i < sequence.length; i++) {
		const p = sequence[i];
		if (p.kind === ref.kind && p.number < ref.number) lastBefore = i;
	}
	return lastBefore + 0.5;
}
