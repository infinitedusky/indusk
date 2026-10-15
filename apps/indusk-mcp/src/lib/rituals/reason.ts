/**
 * The skip-reason rule: a skipped falsification, cleanup or audit gives one
 * sentence of at most SKIP_REASON_MAX characters. Dependency-free on purpose —
 * the admin's browser bundle reaches it through lifecycle.ts, and a module with
 * no imports pulls in no `node:fs`.
 *
 * promise: a-skip-reason-is-one-sentence
 */

/** The longest a skip reason may be: one sentence. */
export const SKIP_REASON_MAX = 120;

/**
 * How many sentences a skip reason holds: its sentence ends plus one, where an
 * end is `.`, `!` or `?` followed by whitespace and an uppercase letter. A dot
 * inside a sentence ("e.g. x", "gate.ts") is not an end.
 */
export function sentenceCount(reason: string): number {
	return (reason.trim().match(/[.!?]\s+(?=\p{Lu})/gu) ?? []).length + 1;
}

/** The one rule: at most SKIP_REASON_MAX characters and at most one sentence. */
export function reasonFits(reason: string): boolean {
	return reason.length <= SKIP_REASON_MAX && sentenceCount(reason) <= 1;
}
