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
 * The heading text every build-phase pattern is built from — declared once so
 * the "any phase" and "this phase" forms cannot drift apart.
 */
const BUILD_PHASE = String.raw`###\s+(?:Build\s+)?Phase`;

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
export const PHASE_HEADING = new RegExp(`^${BUILD_PHASE}\\s+(\\d+)[:\\s]+(.*)`);

/**
 * The same heading, pinned to one specific phase number — what a caller needs
 * when it is walking to *this* phase's block rather than recognising any phase.
 * `\b` keeps Phase 1 from matching Phase 10.
 *
 * Composed from `BUILD_PHASE` rather than restating it. That matters: this
 * pattern previously lived as its own template string in `shape/impl-blocks.ts`,
 * where the escaped-in-a-template form (`\\s`) slipped past the
 * single-definition guard entirely. It matched `### Phase N` only, so once
 * `/planner` began emitting `### Build Phase N`, Shape found no phase at all
 * and appended its findings nowhere — silently.
 */
export function buildPhaseHeadingFor(phase: number): RegExp {
	return new RegExp(`^${BUILD_PHASE}\\s+${phase}\\b`);
}

/** `#### Phase N <Gate>` for one specific phase, either build spelling. */
export function gateHeadingFor(phase: number, gate: string): RegExp {
	return new RegExp(`^####\\s+(?:Build\\s+)?Phase\\s+${phase}\\s+${gate}\\b`);
}

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

/** A fence marker: three or more backticks or tildes, optionally indented. */
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

interface FenceMarker {
	char: "`" | "~";
	length: number;
	/** Text after the marker — an info string, which only an *opener* may have. */
	info: string;
}

function parseFence(line: string): FenceMarker | null {
	const m = FENCE.exec(line);
	if (!m) return null;
	return { char: m[1][0] as "`" | "~", length: m[1].length, info: m[2].trim() };
}

/**
 * The index of the line closing the fence opened at `start`, or `-1`.
 *
 * CommonMark's rule, and it is the rule that matters here: a fence closes only
 * on a marker of the **same character** and **at least the same length**, with
 * nothing after it. That is what lets a carried test body contain a fence of
 * its own — you nest by lengthening the marker — and it is what stops a `~~~`
 * inside a ```` ``` ```` block from ending the block early.
 */
function findFenceClose(lines: string[], start: number, open: FenceMarker): number {
	for (let i = start + 1; i < lines.length; i++) {
		const candidate = parseFence(lines[i]);
		if (
			candidate &&
			candidate.char === open.char &&
			candidate.length >= open.length &&
			candidate.info === ""
		) {
			return i;
		}
	}
	return -1;
}

/**
 * Mark every line that sits inside a fenced code block.
 *
 * Structure-scanning must skip these. A deferral entry in Test Phase 1 may
 * carry the deferred test's body, and that body will contain lines that look
 * exactly like checklist items and gate headings — which is the point of
 * carrying it. A parser that reads them as structure turns a piece of evidence
 * into a phantom phase.
 *
 * **An unterminated fence masks nothing.** Failing open is deliberate: the
 * alternative is that one missing backtick deletes every phase below it from
 * every parser at once, and nothing reports a problem — the zero-phase guard
 * cannot save it, because the phases *above* the fence still parse. A leaked
 * code body produces loud, confusing errors; a swallowed document produces
 * silence, and silence is the failure mode this whole plan exists to remove.
 * The validator separately refuses an impl with an unterminated fence, so the
 * confusing errors are not what the author actually sees.
 */
export function fencedLineMask(lines: string[]): boolean[] {
	const mask = new Array<boolean>(lines.length).fill(false);
	for (let i = 0; i < lines.length; i++) {
		const open = parseFence(lines[i]);
		if (!open) continue;
		const close = findFenceClose(lines, i, open);
		if (close === -1) continue; // unterminated — not a fence at all
		for (let j = i; j <= close; j++) mask[j] = true;
		i = close;
	}
	return mask;
}

/**
 * The 1-based line number of an unterminated fence, or `null` if every fence
 * in `body` is closed. Reported rather than tolerated — see `fencedLineMask`.
 */
export function unterminatedFenceLine(body: string): number | null {
	const lines = body.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const open = parseFence(lines[i]);
		if (!open) continue;
		const close = findFenceClose(lines, i, open);
		if (close === -1) return i + 1;
		i = close;
	}
	return null;
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
/**
 * Whether `ref` names a phase this document actually contains.
 *
 * `Phase 0` is always present by definition: it means "before any of this
 * plan's work", which is a real moment in a plan's life and deliberately has no
 * heading. Every other reference has to point at something written down.
 *
 * The distinction matters for enforcement rather than for ordering. A row whose
 * authoring phase exists can be late; a row naming a phase nobody has written
 * yet cannot be — you cannot miss a deadline that has not been scheduled — and
 * treating the two alike turns a plan's forward reference into a false
 * accusation.
 */
export function phaseExists(ref: PhaseRef, sequence: readonly PhaseRef[]): boolean {
	if (ref.kind === "build" && ref.number === 0) return true;
	return sequence.some((p) => p.kind === ref.kind && p.number === ref.number);
}

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
