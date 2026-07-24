/**
 * Dead-draft plan auto-archive (indusk-makeover Phase 1).
 *
 * A plan directory is a DEAD DRAFT when all three hold:
 *   1. No document in it carries a status beyond draft. Blocking statuses:
 *      `accepted`, `approved`, `in-progress`, `completed`, `complete`,
 *      `proposed`. `draft`, `abandoned`, and a missing status are eligible.
 *      A document whose frontmatter fails to parse BLOCKS archiving
 *      (conservative on bad input — same posture as the sweep's
 *      malformed-timestamp rule).
 *   2. The newest file anywhere in the plan directory is older than
 *      `planning.dead_draft_days` (default 30).
 *   3. master.md does not protect it. Protection rule: a markdown link to
 *      `<name>/...` on a master.md line that does NOT contain the word
 *      "draft" protects the plan (e.g. a "parked" or "PROMOTED" row); a line
 *      that says "brief draft" does not.
 *
 * Archiving MOVES the directory to `.indusk/planning/archive/<name>` —
 * documents intact, nothing deleted. An existing archive entry with the same
 * name causes a skip (never overwrite).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { getDeadDraftDays } from "../config.js";

const BLOCKING_STATUSES = new Set([
	"accepted",
	"approved",
	"in-progress",
	"completed",
	"complete",
	"proposed",
]);

export interface DeadPlanCandidate {
	name: string;
	path: string;
	newestMtimeMs: number;
	/** doc filename → status string ("" when absent). */
	statuses: Record<string, string>;
}

export interface SkippedPlan {
	name: string;
	reason: string;
}

export interface ArchiveDeadOptions {
	days?: number;
	dryRun?: boolean;
	now?: Date;
}

export interface ArchiveDeadResult {
	/** Plans moved to archive/ (or that WOULD move, under dryRun). */
	archived: DeadPlanCandidate[];
	/** Plans examined and left in place, with the blocking reason. */
	skipped: SkippedPlan[];
	dryRun: boolean;
}

function newestMtimeMs(dir: string): number {
	let newest = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) {
			newest = Math.max(newest, newestMtimeMs(p));
		} else {
			newest = Math.max(newest, statSync(p).mtimeMs);
		}
	}
	return newest;
}

/** Names protected by master.md: linked on a line that does not mention "draft". */
function readProtectedNames(planningDir: string): Set<string> {
	const masterPath = join(planningDir, "master.md");
	const protectedNames = new Set<string>();
	if (!existsSync(masterPath)) return protectedNames;
	const lines = readFileSync(masterPath, "utf-8").split("\n");
	for (const line of lines) {
		if (/draft/i.test(line)) continue;
		for (const m of line.matchAll(/\]\(([A-Za-z0-9_-]+)\//g)) {
			if (m[1] !== "archive") protectedNames.add(m[1]);
		}
	}
	return protectedNames;
}

/**
 * Examine every non-archive plan directory and classify it. Pure read.
 * Returns candidates (dead drafts) and skipped plans with reasons.
 */
export function classifyPlans(
	projectRoot: string,
	opts: ArchiveDeadOptions = {},
): { candidates: DeadPlanCandidate[]; skipped: SkippedPlan[] } {
	const planningDir = join(projectRoot, ".indusk/planning");
	const candidates: DeadPlanCandidate[] = [];
	const skipped: SkippedPlan[] = [];
	if (!existsSync(planningDir)) return { candidates, skipped };

	const days = opts.days ?? getDeadDraftDays(projectRoot);
	const now = opts.now ?? new Date();
	const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
	const protectedNames = readProtectedNames(planningDir);

	for (const entry of readdirSync(planningDir, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === "archive") continue;
		const name = entry.name;
		const planDir = join(planningDir, name);

		if (protectedNames.has(name)) {
			skipped.push({ name, reason: "protected by master.md (non-draft row)" });
			continue;
		}

		const statuses: Record<string, string> = {};
		let blocking: string | null = null;
		for (const f of readdirSync(planDir)) {
			if (!f.endsWith(".md")) continue;
			try {
				const parsed = matter(readFileSync(join(planDir, f), "utf-8"));
				const status = typeof parsed.data.status === "string" ? parsed.data.status : "";
				statuses[f] = status;
				if (BLOCKING_STATUSES.has(status.toLowerCase())) {
					blocking = `${f} has status "${status}"`;
				}
			} catch {
				blocking = `${f} has unparseable frontmatter`;
				statuses[f] = "(unparseable)";
			}
		}
		if (blocking) {
			skipped.push({ name, reason: blocking });
			continue;
		}

		const newest = newestMtimeMs(planDir);
		if (newest >= cutoffMs) {
			skipped.push({ name, reason: `active within ${days}d (newest file too recent)` });
			continue;
		}

		candidates.push({ name, path: planDir, newestMtimeMs: newest, statuses });
	}

	return { candidates, skipped };
}

/**
 * Move every dead-draft plan to `.indusk/planning/archive/`. Never deletes;
 * never overwrites an existing archive entry (collision → skip).
 */
export function archiveDeadPlans(
	projectRoot: string,
	opts: ArchiveDeadOptions = {},
): ArchiveDeadResult {
	const dryRun = opts.dryRun === true;
	const { candidates, skipped } = classifyPlans(projectRoot, opts);
	const archiveDir = join(projectRoot, ".indusk/planning/archive");

	const archived: DeadPlanCandidate[] = [];
	for (const candidate of candidates) {
		const target = join(archiveDir, candidate.name);
		if (existsSync(target)) {
			skipped.push({ name: candidate.name, reason: "archive/ already has a plan by this name" });
			continue;
		}
		if (!dryRun) {
			mkdirSync(archiveDir, { recursive: true });
			renameSync(candidate.path, target);
		}
		archived.push(candidate);
	}

	return { archived, skipped, dryRun };
}
