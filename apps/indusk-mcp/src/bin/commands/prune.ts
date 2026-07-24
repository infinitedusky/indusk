/**
 * `indusk prune --dry-run` — context-budget measurement surface.
 *
 * Reports CLAUDE.md size by section, per-lesson ages, per-current-md-section
 * ages, and total auto-loaded bytes. Recommends manual cleanup commands.
 *
 * `--dry-run` is the DEFAULT — no destructive action in v1. Auto-pruning
 * (`--apply`) is intentionally deferred to a future architectural plan
 * (Piece 3 of context-budget). v1 surfaces; operator decides.
 *
 * See `.indusk/planning/context-budget/` for full design.
 */

import { measureProjectContext, type PruneReport } from "../../lib/prune/measure.js";

interface PruneOptions {
	dryRun?: boolean;
	largeSectionChars?: number;
	staleLessonDays?: number;
	staleSectionDays?: number;
}

export async function prune(projectRoot: string, opts: PruneOptions = {}): Promise<void> {
	// --dry-run is the default. v1 has no other mode.
	if (opts.dryRun === false) {
		console.error(
			"Error: --dry-run is the only supported mode in this version. " +
				"Auto-pruning (--apply) is intentionally deferred to a future architectural " +
				"plan. See .indusk/planning/context-budget/ for the design.",
		);
		process.exit(2);
	}

	const thresholds: Parameters<typeof measureProjectContext>[1] = {};
	if (opts.largeSectionChars !== undefined) thresholds.large_section_chars = opts.largeSectionChars;
	if (opts.staleLessonDays !== undefined) thresholds.stale_lesson_days = opts.staleLessonDays;
	if (opts.staleSectionDays !== undefined) thresholds.stale_section_days = opts.staleSectionDays;

	const report = measureProjectContext(projectRoot, thresholds);
	printReport(projectRoot, report);
	// Always exit 0 — this is informational, never an error.
	process.exit(0);
}

function printReport(projectRoot: string, report: PruneReport): void {
	console.info(`\n[indusk prune --dry-run] context-budget audit for ${projectRoot}\n`);

	if (report.notes.length > 0) {
		for (const note of report.notes) console.info(`  note: ${note}`);
		console.info("");
	}

	printClaudeMd(report);
	printCurrentMd(report);
	printLessons(report);
	printSummary(report);
}

function printClaudeMd(report: PruneReport): void {
	console.info("CLAUDE.md sections:");
	if (report.claudeMd.length === 0) {
		console.info("  (no CLAUDE.md or no ## sections found)\n");
		return;
	}
	for (const section of report.claudeMd) {
		const marker = section.flagged ? "  ⚠ " : "    ";
		console.info(`${marker}${section.title.padEnd(30)} ${formatBytes(section.sizeChars)}`);
		if (section.recommendedAction) {
			console.info(`      → ${section.recommendedAction}`);
		}
	}
	console.info("");
}

function printCurrentMd(report: PruneReport): void {
	console.info("current.md:");
	if (!report.currentMd.exists) {
		console.info("  (not found — run indusk init or check workbench root)\n");
		return;
	}
	console.info(
		`  total size: ${formatBytes(report.currentMd.totalSizeChars)}, ` +
			`shared section: ${formatBytes(report.currentMd.sharedSectionSizeChars)}, ` +
			`agent sections: ${report.currentMd.sectionCount}`,
	);
	if (report.currentMd.staleSections.length > 0) {
		console.info(`  ⚠ ${report.currentMd.staleSections.length} stale per-agent section(s):`);
		for (const section of report.currentMd.staleSections) {
			console.info(
				`      session ${section.sessionShort} (${section.task}) — ${section.ageDays}d old, ${formatBytes(section.sizeChars)} body`,
			);
		}
		console.info("    → Consider archiving stale sections from .indusk/current.md.");
		console.info("    → Auto-archive will land in context-budget Piece 3; manual edit for now.");
	}
	console.info("");
}

function printLessons(report: PruneReport): void {
	console.info("Lessons (.claude/lessons/):");
	if (report.lessons.length === 0) {
		console.info("  (none found)\n");
		return;
	}
	const flagged = report.lessons.filter((l) => l.flagged);
	console.info(`  total: ${report.lessons.length} lesson(s); ${flagged.length} stale`);
	if (flagged.length > 0) {
		console.info("  ⚠ Stale (consider reviewing or removing):");
		for (const lesson of flagged) {
			console.info(
				`      ${lesson.name.padEnd(50)} ${lesson.ageDays}d old (${lesson.lastModified.slice(0, 10)})`,
			);
		}
		console.info(
			"    → Lessons referencing code/conventions that no longer exist are dead weight.",
		);
		console.info("    → Review each; `rm -i <path>` after confirming irrelevance.");
	}
	console.info("");
}

function printSummary(report: PruneReport): void {
	const flaggedClaudeMd = report.claudeMd.filter((s) => s.flagged).length;
	const flaggedLessons = report.lessons.filter((l) => l.flagged).length;
	const staleSections = report.currentMd.staleSections.length;
	const totalFlagged = flaggedClaudeMd + flaggedLessons + staleSections;

	console.info("Summary:");
	console.info(
		`  Estimated auto-loaded bytes per catchup: ${formatBytes(report.estimatedAutoLoadBytes)}`,
	);
	console.info(
		`  Flagged: ${flaggedClaudeMd} CLAUDE.md section(s), ${flaggedLessons} lesson(s), ${staleSections} current.md section(s)`,
	);
	if (totalFlagged === 0) {
		console.info("  ✓ No bloat detected at current thresholds.");
	} else {
		console.info("  → No destructive action taken (this is --dry-run; v1 has no --apply mode).");
		console.info("  → See .indusk/planning/context-budget/ for the distillation discipline.");
	}
	console.info("");
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n}B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
	return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
