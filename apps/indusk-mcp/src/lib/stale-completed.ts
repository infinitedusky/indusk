import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

/**
 * Plans whose impl has been `completed` for longer than the grace period with
 * no retrospective — reported by `check_health` as an error.
 *
 * The indusk-makeover plan sat 53 days between impl-complete and its
 * retrospective, in a queue labelled "any time". Every system that touched it
 * was working as designed, and nothing treated the wait as a fault: a plan
 * status meaning "correctly protected, awaiting a human step" can sit unclosed
 * indefinitely. Health is read at every catchup, so an error there is the one
 * place visibility becomes a trigger (carried into dawn-workbench-execution from
 * hook-cwd-independence's cut).
 *
 * The clock is the impl's `updated:` frontmatter, else its `date:` — the plan's
 * own record of when it last moved, not the filesystem's. A plan with neither
 * cannot be aged and is not reported: a missing date is not evidence of delay.
 */

export interface StaleCompletedPlan {
	plan: string;
	/** The `updated:` (else `date:`) the impl carries, as written. */
	since: string;
	daysAgo: number;
}

export const STALE_COMPLETED_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value: unknown): Date | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value !== "string" || value.trim() === "") return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asDateString(value: unknown): string {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value);
}

/**
 * Every active plan (not the archive) whose impl says `completed`, has no
 * `retrospective.md` beside it, and last moved more than `days` ago.
 */
export function findStaleCompletedPlans(
	projectRoot: string,
	options: { now?: Date; days?: number } = {},
): StaleCompletedPlan[] {
	const planningDir = join(projectRoot, ".indusk", "planning");
	if (!existsSync(planningDir)) return [];
	const now = options.now ?? new Date();
	const days = options.days ?? STALE_COMPLETED_DAYS;

	const findings: StaleCompletedPlan[] = [];
	for (const entry of readdirSync(planningDir, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === "archive") continue;
		const dir = join(planningDir, entry.name);
		const implPath = join(dir, "impl.md");
		if (!existsSync(implPath)) continue;
		if (existsSync(join(dir, "retrospective.md"))) continue;

		let data: Record<string, unknown>;
		try {
			data = matter(readFileSync(implPath, "utf-8")).data as Record<string, unknown>;
		} catch {
			continue; // malformed frontmatter is the validator's finding, not a stale plan
		}
		if (data.status !== "completed") continue;

		const clock = asDate(data.updated) ?? asDate(data.date);
		if (!clock) continue;
		const daysAgo = Math.floor((now.getTime() - clock.getTime()) / DAY_MS);
		if (daysAgo <= days) continue;

		findings.push({
			plan: entry.name,
			since: asDateString(data.updated ?? data.date),
			daysAgo,
		});
	}
	return findings.sort((a, b) => b.daysAgo - a.daysAgo);
}
