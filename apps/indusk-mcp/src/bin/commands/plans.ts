import { archiveDeadPlans } from "../../lib/planning/archive-dead.js";

export interface PlansArchiveDeadOptions {
	dryRun?: boolean;
}

/**
 * `indusk plans archive-dead [--dry-run]` — move dead-draft plans to
 * `.indusk/planning/archive/`. Dead = all docs draft/abandoned/no-status AND
 * newest file older than `planning.dead_draft_days` (default 30) AND not
 * protected by a non-draft master.md row. Moves, never deletes.
 */
export function plansArchiveDead(projectRoot: string, opts: PlansArchiveDeadOptions = {}): void {
	const result = archiveDeadPlans(projectRoot, { dryRun: opts.dryRun });
	const verb = result.dryRun ? "Would archive" : "Archived";
	if (result.archived.length === 0) {
		console.info("No dead-draft plans found.");
	} else {
		console.info(`${verb} ${result.archived.length} dead-draft plan(s):`);
		for (const p of result.archived) {
			const age = new Date(p.newestMtimeMs).toISOString().slice(0, 10);
			console.info(`  - ${p.name} (newest file ${age})`);
		}
	}
	const interesting = result.skipped.filter(
		(s) => !s.reason.startsWith("active within"), // recently-touched plans are the boring common case
	);
	if (interesting.length > 0) {
		console.info("Skipped:");
		for (const s of interesting) {
			console.info(`  - ${s.name}: ${s.reason}`);
		}
	}
}
