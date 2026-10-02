/**
 * The one token grammar (context-tiers, ADR D2).
 *
 * A token is the kind, a colon, a space and the name, sitting where prose
 * cannot be mistaken for it: a promise's beside a code site or in a test, a
 * lesson's at the start of a failing test's message or a hook's refusal line.
 * (No example is spelled out here: this file documents the marker, and the
 * scanner read the first draft's example as a citation of a promise that does
 * not exist.) day-promises wrote the grammar for promises; the lesson token is
 * the second kind, and a third is added here, never as a second pattern.
 *
 * Two rules keep a bare `promise:` from reading as a citation where it is
 * only a word — found by running the check against this repository, which
 * has a field named `promise`, a test example, and a package called `promise`
 * in its lockfile (`promise: 4`):
 *
 *   1. the token must FOLLOW a comment opener or a quote on the same line, so
 *      a type annotation, a YAML key at line start and a lockfile entry never
 *      match;
 *   2. a name starts with a letter.
 */

export const TOKEN_KINDS = ["promise", "lesson"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

/**
 * What may sit before the token on its line (day-promises A27, the
 * falsification's refinement of rule 1): a comment opener anywhere EARLIER on
 * the line (`//`, `#`, `/*`, `<!--` — so `// enforces` followed by the token
 * counts), a line-leading docblock, SQL or ini opener (`*`, `--`, `;`) with
 * any text after it, or a quote DIRECTLY before the token (so a type
 * annotation on a line with an earlier string literal still does not count).
 * A test's assertion message and a hook's template string both open with a
 * quote, which is why one scanner reads both.
 */
export const TOKEN_OPENER = String.raw`(?<=(?:(?:\/\/|#|\/\*|<!--)[^\n]*|(?:^|\n)[ \t]*(?:\*|--|;)[^\n]*|["'${"`"}][ \t]*))`;

/** The token as it is written. */
export function token(kind: TokenKind, name: string): string {
	return `${kind}: ${name}`;
}

/** Matches the token for one specific name. */
export function tokenPattern(kind: TokenKind, name: string): RegExp {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`${TOKEN_OPENER}${kind}:[ \\t]*${escaped}(?![a-z0-9-])`);
}

/** Matches every token of a kind in a text; group 1 is the name. Fresh per call (it is global). */
export function anyTokenPattern(kind: TokenKind): RegExp {
	return new RegExp(`${TOKEN_OPENER}${kind}:[ \\t]*([a-z][a-z0-9-]*)(?![a-z0-9-])`, "g");
}
