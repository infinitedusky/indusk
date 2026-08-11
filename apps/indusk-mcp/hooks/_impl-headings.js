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
