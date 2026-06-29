/**
 * Context-budget measurement library (1.31.11).
 *
 * Pure function `measureProjectContext(projectRoot, thresholds?)` returns a
 * structured PruneReport describing what's accreted in the project's auto-
 * loaded surfaces (CLAUDE.md sections, lessons, current.md sections). The
 * `indusk prune --dry-run` CLI consumes this report and prints a human-
 * readable surface with recommended manual cleanup commands.
 *
 * The library is read-only — no writes, no side effects. Auto-pruning is
 * intentionally deferred to a future architectural plan (Piece 3 of the
 * context-budget brief). v1 surfaces; operator decides.
 *
 * See `.indusk/planning/context-budget/` for full design.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseCurrentMd } from "../agents/current-md.js";

export interface Thresholds {
	/** Flag CLAUDE.md sections larger than this. */
	large_section_chars: number;
	/** Flag lessons whose mtime is older than this. */
	stale_lesson_days: number;
	/** Flag current.md per-agent sections whose lastUpdated is older than this. */
	stale_section_days: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
	large_section_chars: 4000,
	stale_lesson_days: 180,
	stale_section_days: 7,
};

export interface ClaudeMdSection {
	title: string;
	sizeChars: number;
	flagged: boolean;
	recommendedAction?: string;
}

export interface LessonReport {
	name: string;
	path: string;
	sizeChars: number;
	lastModified: string;
	ageDays: number;
	flagged: boolean;
	recommendedAction?: string;
}

export interface CurrentMdStaleSection {
	sessionId: string;
	sessionShort: string;
	task: string;
	lastUpdated: string;
	ageDays: number;
	sizeChars: number;
}

export interface CurrentMdReport {
	exists: boolean;
	totalSizeChars: number;
	sharedSectionSizeChars: number;
	sectionCount: number;
	staleSections: CurrentMdStaleSection[];
}

export interface PruneReport {
	claudeMd: ClaudeMdSection[];
	lessons: LessonReport[];
	currentMd: CurrentMdReport;
	/** Approximate total bytes loaded into every conversation today. */
	estimatedAutoLoadBytes: number;
	/** Diagnostic notes about what was found / missing. */
	notes: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Split CLAUDE.md body into sections by `^## ` headings. Returns the section
 * title (without the `## ` prefix) and the body (everything until the next
 * `## ` heading or EOF). Lines before the first `## ` are not returned (the
 * `# H1` preamble is treated as overhead, not a section).
 */
function splitClaudeMdSections(body: string): { title: string; content: string }[] {
	const lines = body.split("\n");
	const sections: { title: string; content: string }[] = [];
	let current: { title: string; lines: string[] } | null = null;
	for (const line of lines) {
		const match = /^## (.+)$/.exec(line);
		if (match) {
			if (current) {
				sections.push({ title: current.title, content: current.lines.join("\n") });
			}
			current = { title: match[1].trim(), lines: [] };
		} else if (current) {
			current.lines.push(line);
		}
	}
	if (current) {
		sections.push({ title: current.title, content: current.lines.join("\n") });
	}
	return sections;
}

function readClaudeMd(projectRoot: string, thresholds: Thresholds): ClaudeMdSection[] {
	const claudeMdPath = join(projectRoot, "CLAUDE.md");
	if (!existsSync(claudeMdPath)) return [];
	const body = readFileSync(claudeMdPath, "utf-8");
	const sections = splitClaudeMdSections(body);
	return sections.map((s) => {
		const sizeChars = s.content.length;
		const flagged = sizeChars > thresholds.large_section_chars;
		const out: ClaudeMdSection = { title: s.title, sizeChars, flagged };
		if (flagged) {
			out.recommendedAction = `Collapse "${s.title}" to one-line entries + links to archive. ${sizeChars} chars currently; target < ${thresholds.large_section_chars}. See .indusk/planning/context-budget/ for the distillation discipline.`;
		}
		return out;
	});
}

function readLessons(projectRoot: string, thresholds: Thresholds): LessonReport[] {
	const lessonsDir = join(projectRoot, ".claude/lessons");
	if (!existsSync(lessonsDir)) return [];
	const now = Date.now();
	const reports: LessonReport[] = [];
	const entries = readdirSync(lessonsDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const path = join(lessonsDir, entry.name);
		let stat: ReturnType<typeof statSync>;
		try {
			stat = statSync(path);
		} catch {
			continue;
		}
		const ageDays = Math.floor((now - stat.mtimeMs) / MS_PER_DAY);
		const flagged = ageDays > thresholds.stale_lesson_days;
		const lastModified = new Date(stat.mtimeMs).toISOString();
		const report: LessonReport = {
			name: entry.name.replace(/\.md$/, ""),
			path,
			sizeChars: stat.size,
			lastModified,
			ageDays,
			flagged,
		};
		if (flagged) {
			report.recommendedAction = `Review and (if obsolete) rm -i "${path}". Untouched for ${ageDays} days; threshold is ${thresholds.stale_lesson_days}.`;
		}
		reports.push(report);
	}
	return reports.sort((a, b) => b.ageDays - a.ageDays);
}

function readCurrentMd(projectRoot: string, thresholds: Thresholds): CurrentMdReport {
	const currentMdPath = join(projectRoot, ".indusk/current.md");
	if (!existsSync(currentMdPath)) {
		return {
			exists: false,
			totalSizeChars: 0,
			sharedSectionSizeChars: 0,
			sectionCount: 0,
			staleSections: [],
		};
	}
	const body = readFileSync(currentMdPath, "utf-8");
	const parsed = parseCurrentMd(body);
	const now = Date.now();
	const stale: CurrentMdStaleSection[] = [];
	for (const section of parsed.sections) {
		const lastUpdatedMs = Date.parse(section.lastUpdated);
		if (Number.isNaN(lastUpdatedMs)) continue;
		const ageDays = Math.floor((now - lastUpdatedMs) / MS_PER_DAY);
		if (ageDays <= thresholds.stale_section_days) continue;
		const sectionSize =
			section.inFlight.length + section.openQuestions.length + section.cursor.length;
		stale.push({
			sessionId: section.sessionId,
			sessionShort: section.sessionShort,
			task: section.task,
			lastUpdated: section.lastUpdated,
			ageDays,
			sizeChars: sectionSize,
		});
	}
	return {
		exists: true,
		totalSizeChars: body.length,
		sharedSectionSizeChars: parsed.sharedSection.length,
		sectionCount: parsed.sections.length,
		staleSections: stale,
	};
}

/**
 * Measure the project's auto-loaded context surfaces. Pure-read, no side
 * effects. Returns a structured report the CLI prints + future tooling can
 * consume programmatically.
 */
export function measureProjectContext(
	projectRoot: string,
	thresholds?: Partial<Thresholds>,
): PruneReport {
	const resolved: Thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
	const notes: string[] = [];

	const induskDir = join(projectRoot, ".indusk");
	if (!existsSync(induskDir)) {
		notes.push(`no .indusk/ directory found at ${projectRoot} — not an InDusk project, or init not run`);
	}

	const claudeMd = readClaudeMd(projectRoot, resolved);
	if (claudeMd.length === 0) {
		notes.push("no CLAUDE.md found (or no ## sections)");
	}

	const lessons = readLessons(projectRoot, resolved);
	if (lessons.length === 0) {
		notes.push("no lessons found in .claude/lessons/");
	}

	const currentMd = readCurrentMd(projectRoot, resolved);

	// Estimated auto-loaded bytes — approximate sum of what catchup loads.
	const claudeMdBytes = claudeMd.reduce((sum, s) => sum + s.sizeChars, 0);
	const lessonsBytes = lessons.reduce((sum, l) => sum + l.sizeChars, 0);
	// Lessons are lazy-loaded as of 1.31.5; only titles + paths appear in
	// list_lessons output. Estimate ~150 bytes per lesson for the summary.
	const lessonsTitlesBytes = lessons.length * 150;
	const estimatedAutoLoadBytes = claudeMdBytes + lessonsTitlesBytes + currentMd.totalSizeChars;

	return {
		claudeMd,
		lessons,
		currentMd,
		estimatedAutoLoadBytes,
		notes,
	};
}
