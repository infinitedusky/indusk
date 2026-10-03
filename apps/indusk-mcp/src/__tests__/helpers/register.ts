/**
 * The context-tiers classification register (`register.md`), read one way.
 *
 * Three tests parsed it — the baseline check, the eight-pins check and the
 * enforcer-guard check — each splitting the same table and reading a
 * different subset of its columns. One reader, so a column added or moved is
 * a one-line change, not three silent misreads (the trajectory-row lesson).
 */

export const REGISTER_TIERS = ["enforcer", "directory", "root", "current.md", "deleted"] as const;
export type RegisterTier = (typeof REGISTER_TIERS)[number];

export interface RegisterRow {
	/** The row number, as written. */
	row: string;
	section: string;
	/** The entry's first words. */
	entry: string;
	tier: RegisterTier;
	destination: string;
	/** The enforcer and the lesson it names, for an `enforcer` row. */
	enforcer: string;
	/** What stays as prose, and where. */
	remainder: string;
}

/** Every numbered row whose tier is a register tier; header and legend tables are skipped. */
export function registerRows(md: string): RegisterRow[] {
	return md
		.split("\n")
		.filter((l) => /^\|\s*\d+\s*\|/.test(l))
		.map((l) => l.split("|").map((c) => c.trim()))
		.filter((c) => (REGISTER_TIERS as readonly string[]).includes(c[4]))
		.map((c) => ({
			row: c[1],
			section: c[2],
			entry: c[3],
			tier: c[4] as RegisterTier,
			destination: c[5],
			enforcer: c[6] ?? "",
			remainder: c[7] ?? "",
		}));
}
