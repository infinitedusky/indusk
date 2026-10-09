import { isRitualSkipped, type SkipCheck } from "../rituals/skip.js";

export type { SkipCheck } from "../rituals/skip.js";

/**
 * Parse an impl.md body (the full file content including frontmatter) and
 * return whether the author has explicitly opted out of the falsification
 * ritual. Opt-out requires both fields in frontmatter:
 *
 *   falsification: skipped
 *   falsification_reason: "a non-empty reason"
 *
 * Returns `{ skipped: true, reason }` only if both fields are present and
 * the reason is non-empty after trimming. Any other state — missing
 * `falsification`, falsification set to anything other than `skipped`,
 * missing or empty reason — returns `{ skipped: false, reason: null }`.
 *
 * The two-field shape matches the planner skill's precedent (gate_policy
 * as a single enum value) while keeping the reason unambiguous against
 * YAML parsers. Colons inside quoted YAML strings are fragile across
 * parsers; two fields avoid that class of bug entirely.
 */
export function isFalsificationSkipped(implContent: string): SkipCheck {
	return isRitualSkipped(implContent, "falsification");
}
