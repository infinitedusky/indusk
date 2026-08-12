/**
 * Deliberate port of `src/lib/impl-headings.ts` — the one definition of every
 * heading an impl document uses.
 *
 * The hooks are plain JS and cannot import the `.ts` source, so a mirror is
 * unavoidable. What is avoidable is three mirrors: `check-gates`,
 * `gate-reminder` and `validate-impl-structure` each carried their own copy of
 * these patterns, which is how a six-copy fan-out grew without anyone
 * noticing. This module is hook-local (`_`-prefixed): it is imported by hooks,
 * never registered as one, so it needs no settings entry — but it must exist
 * in `.claude/hooks/` or every importer dies at load. `globSync("*.js")` copies
 * it on init and update; keep it here and never resolve a hook's import
 * outside this directory.
 *
 * Change `src/lib/impl-headings.ts` and this file together. Nothing detects a
 * divergence between them — the TS single-definition test counts `src/` only,
 * because these are ports by necessity rather than duplicates by accident.
 */

/** `### Phase N: Name` or `### Build Phase N: Name`. [1]=number, [2]=name. */
export const PHASE_HEADING = /^###\s+(?:Build\s+)?Phase\s+(\d+)[:\s]+(.*)/;

/** `### Test Phase N: Name`. [1]=number, [2]=name. */
export const TEST_PHASE_HEADING = /^###\s+Test\s+Phase\s+(\d+)[:\s]+(.*)/;

/** Any phase heading, either kind. [1]=number. */
export const ANY_PHASE_HEADING = /^###\s+(?:Test\s+|Build\s+)?Phase\s+(\d+)\b/;

/**
 * Deliberately unanchored — used only to answer "does this edit touch phase
 * structure at all?", where matching `#### Phase 1 Verification` as well as
 * `### Phase 1` is the intent rather than a bug. It is why the validator
 * re-validates the whole file when an edit's `new_string` contains a gate
 * heading, which is a documented gotcha and not something to quietly tighten:
 * the wide net is what stops a gate-only edit from escaping validation.
 */
export const ANY_PHASE_HEADING_LOOSE = /###\s+(?:Test\s+|Build\s+)?Phase\s+\d+/;

/** `#### Phase N Forward Intelligence`, in any phase-kind spelling. */
export const FORWARD_INTELLIGENCE_HEADING =
	/^####\s+(?:Test\s+|Build\s+)?Phase\s+\d+\s+Forward Intelligence\b/;

/**
 * `#### Phase N <kind>`. **[1] is always the phase number**; an alternation
 * passed as `kind` lands at [2].
 */
export function gateHeading(kind) {
	return new RegExp(`^####\\s+(?:Test\\s+|Build\\s+)?Phase\\s+(\\d+)\\s+${kind}\\b`);
}

/**
 * Parse a line as a phase heading, or `null`.
 *
 * Test phases are tried first so the distinction is a property of this
 * function rather than of a regex someone might later loosen.
 */
export function parsePhaseHeading(line) {
	const test = TEST_PHASE_HEADING.exec(line);
	if (test) {
		return { kind: "test", number: parseInt(test[1], 10), name: test[2].trim() };
	}
	const build = PHASE_HEADING.exec(line);
	if (build) {
		return { kind: "build", number: parseInt(build[1], 10), name: build[2].trim() };
	}
	return null;
}

/** `Phase 3`, `Build Phase 3`, `Test Phase 1` — a whole trajectory cell. */
export const PHASE_REFERENCE = /^\s*(Test\s+|Build\s+)?Phase\s+(\d+)\s*$/i;

/** Parse a `Writable at` / `Passes at` cell. `null` if not a reference. */
export function parsePhaseRef(cell) {
	const match = PHASE_REFERENCE.exec(cell);
	if (!match) return null;
	const kind = match[1]?.trim().toLowerCase() === "test" ? "test" : "build";
	return { kind, number: parseInt(match[2], 10) };
}

/** A fence marker: three or more backticks or tildes, optionally indented. */
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

function parseFence(line) {
	const m = FENCE.exec(line);
	if (!m) return null;
	return { char: m[1][0], length: m[1].length, info: m[2].trim() };
}

/**
 * CommonMark's closing rule: same character, at least the same length, nothing
 * after it. That is what lets a carried body nest a fence by lengthening the
 * marker, and what stops a `~~~` inside a ``` block from ending it early.
 */
function findFenceClose(lines, start, open) {
	for (let i = start + 1; i < lines.length; i++) {
		const c = parseFence(lines[i]);
		if (c && c.char === open.char && c.length >= open.length && c.info === "") return i;
	}
	return -1;
}

/**
 * Mark every line inside a fenced code block. Structure-scanning must skip
 * these: a Test Phase 1 deferral may carry the deferred test's body, and that
 * body contains lines that look exactly like checklist items and gate
 * headings — which is the point of carrying it.
 *
 * **An unterminated fence masks nothing** — failing open, deliberately. One
 * missing backtick would otherwise delete every phase below it from every
 * parser at once with nothing reporting a problem, and the zero-phase guard
 * cannot save it because the phases above still parse. Silence is the failure
 * mode this plan exists to remove; the validator refuses such an impl outright.
 */
export function fencedLineMask(lines) {
	const mask = new Array(lines.length).fill(false);
	for (let i = 0; i < lines.length; i++) {
		const open = parseFence(lines[i]);
		if (!open) continue;
		const close = findFenceClose(lines, i, open);
		if (close === -1) continue;
		for (let j = i; j <= close; j++) mask[j] = true;
		i = close;
	}
	return mask;
}

/** 1-based line of an unterminated fence, or `null`. See `fencedLineMask`. */
export function unterminatedFenceLine(body) {
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
export function phaseSequence(body) {
	const lines = body.split("\n");
	const fenced = fencedLineMask(lines);
	const out = [];
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
 * **A document with no test phase reduces to the phase number**, exactly as
 * before — backward compatibility is a property of this function rather than a
 * claim made about it elsewhere, and `Phase 0` keeps ordering before `Phase 1`
 * by arithmetic with no special case.
 */
/**
 * Whether `ref` names a phase this document actually contains.
 *
 * `Phase 0` is always present by definition — it means "before any of this
 * plan's work", a real moment that deliberately has no heading. Everything else
 * must point at something written down: a row whose authoring phase exists can
 * be late, a row naming a phase nobody has written yet cannot be, and treating
 * the two alike turns a forward reference into a false accusation.
 */
export function phaseExists(ref, sequence) {
	if (ref.kind === "build" && ref.number === 0) return true;
	return sequence.some((p) => p.kind === ref.kind && p.number === ref.number);
}

export function phaseOrdinal(ref, sequence) {
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
