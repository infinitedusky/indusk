import matter from "gray-matter";

export interface SkipCheck {
	skipped: boolean;
	reason: string | null;
}

/**
 * Whether the impl (full file content, frontmatter included) opts out of a
 * ritual. Opt-out requires both fields in frontmatter:
 *
 *   <ritual>: skipped
 *   <ritual>_reason: "a non-empty reason"
 *
 * Returns `{ skipped: true, reason }` only if both are present and the reason
 * is non-empty after trimming. Any other state — a bare flag, a flag set to
 * anything but `skipped`, a missing, empty or non-string reason, another
 * ritual's pair, unparsable frontmatter — returns `{ skipped: false, reason: null }`.
 *
 * The two-field shape keeps the reason unambiguous against YAML parsers:
 * colons inside quoted YAML strings are fragile across parsers.
 */
export function isRitualSkipped(
	implContent: string,
	ritual: "falsification" | "cleanup" | "audit",
): SkipCheck {
	try {
		const { data } = matter(implContent);
		if (data[ritual] !== "skipped") return { skipped: false, reason: null };
		const reasonRaw = data[`${ritual}_reason`];
		if (typeof reasonRaw !== "string") return { skipped: false, reason: null };
		const reason = reasonRaw.trim();
		if (!reason) return { skipped: false, reason: null };
		return { skipped: true, reason };
	} catch {
		return { skipped: false, reason: null };
	}
}
