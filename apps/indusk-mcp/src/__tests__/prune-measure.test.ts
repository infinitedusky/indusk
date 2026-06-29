import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { measureProjectContext } from "../lib/prune/measure.js";

/**
 * Phase 1 of context-budget. The pure-function library that powers
 * `indusk prune --dry-run`. Reports CLAUDE.md size by section, per-lesson
 * ages, per-current-md-section ages, total auto-loaded bytes, and
 * recommended manual cleanup commands.
 *
 * The library is pure: no writes, no side effects.
 *
 * T1: returns a PruneReport with sizes per CLAUDE.md section, per-lesson
 *     ages, per-current-md-section ages, and totalEstimate
 * T2: degrades gracefully when no .indusk/ dir exists (no throw)
 * T3: flags CLAUDE.md sections larger than large_section_chars threshold
 *     with a recommended_action
 * T4: flags lessons older than stale_lesson_days threshold with last-
 *     modified date + opt-in deletion command
 * T5: flags current.md per-agent sections older than stale_section_days
 *     threshold with session ID + last-updated timestamp
 */

function writeClaudeMd(projectRoot: string, sections: Record<string, string>): void {
	const body = [
		"# Test Project — CLAUDE.md",
		"",
		...Object.entries(sections).flatMap(([title, content]) => [`## ${title}`, "", content, ""]),
	].join("\n");
	writeFileSync(join(projectRoot, "CLAUDE.md"), body);
}

function writeCurrentMd(projectRoot: string, content: string): void {
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
	writeFileSync(join(projectRoot, ".indusk/current.md"), content);
}

function writeLesson(claudeDir: string, name: string, body: string, mtimeMs?: number): void {
	mkdirSync(claudeDir, { recursive: true });
	const lessonPath = join(claudeDir, `${name}.md`);
	writeFileSync(lessonPath, body);
	if (mtimeMs !== undefined) {
		utimesSync(lessonPath, new Date(mtimeMs), new Date(mtimeMs));
	}
}

describe("Phase 1: measureProjectContext", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "prune-measure-"));
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	describe("T1: basic shape", () => {
		it("returns a PruneReport with claudeMd, lessons, currentMd, and estimatedAutoLoadBytes", () => {
			writeClaudeMd(tmpRoot, {
				"What This Is": "A test project.",
				"Architecture": "Simple monorepo.",
				"Current State": "All systems green.",
			});
			mkdirSync(join(tmpRoot, ".indusk"), { recursive: true });
			writeFileSync(
				join(tmpRoot, ".indusk/config.json"),
				JSON.stringify({ project_name: "test" }),
			);
			writeLesson(join(tmpRoot, ".claude/lessons"), "community-test", "# Test lesson\n\nBody.");

			const report = measureProjectContext(tmpRoot);

			expect(report.claudeMd, "claudeMd section list").toBeDefined();
			expect(report.claudeMd.length).toBeGreaterThanOrEqual(3);
			expect(report.lessons.length).toBeGreaterThanOrEqual(1);
			expect(report.currentMd).toBeDefined();
			expect(report.estimatedAutoLoadBytes).toBeGreaterThan(0);
			expect(report.notes).toBeInstanceOf(Array);

			const stateSection = report.claudeMd.find((s) => s.title === "Current State");
			expect(stateSection?.sizeChars).toBeGreaterThan(0);
		});
	});

	describe("T2: degrades gracefully without .indusk/", () => {
		it("returns a non-throwing report when .indusk/ is absent", () => {
			// No .indusk/, no CLAUDE.md, no .claude/lessons/
			const report = measureProjectContext(tmpRoot);

			expect(report).toBeDefined();
			expect(report.claudeMd).toEqual([]);
			expect(report.lessons).toEqual([]);
			expect(report.currentMd.exists).toBe(false);
			expect(report.notes.length).toBeGreaterThan(0);
			expect(report.notes.some((n) => /no \.indusk/i.test(n))).toBe(true);
		});
	});

	describe("T3: flags CLAUDE.md sections over the large_section_chars threshold", () => {
		it("flags oversized sections with a recommended_action", () => {
			const bigBody = "x".repeat(5000); // > 4000 default
			writeClaudeMd(tmpRoot, {
				"Current State": bigBody,
				"Architecture": "small",
			});

			const report = measureProjectContext(tmpRoot, { large_section_chars: 4000 });

			const stateSection = report.claudeMd.find((s) => s.title === "Current State");
			expect(stateSection?.flagged).toBe(true);
			expect(stateSection?.recommendedAction).toMatch(/collapse|distill|one-line/i);

			const archSection = report.claudeMd.find((s) => s.title === "Architecture");
			expect(archSection?.flagged).toBe(false);
		});
	});

	describe("T4: flags lessons older than stale_lesson_days threshold", () => {
		it("includes lastModified + recommendedAction for stale lessons", () => {
			const claudeDir = join(tmpRoot, ".claude/lessons");
			// Recent lesson (today)
			writeLesson(claudeDir, "community-recent", "# Recent\n\nBody.");
			// Stale lesson (300 days ago)
			const staleMtime = Date.now() - 300 * 24 * 60 * 60 * 1000;
			writeLesson(claudeDir, "community-stale", "# Stale\n\nBody.", staleMtime);

			const report = measureProjectContext(tmpRoot, { stale_lesson_days: 180 });

			const stale = report.lessons.find((l) => l.name.includes("stale"));
			expect(stale?.flagged).toBe(true);
			expect(stale?.lastModified).toBeDefined();
			expect(stale?.recommendedAction).toMatch(/rm -i|review/i);

			const recent = report.lessons.find((l) => l.name.includes("recent"));
			expect(recent?.flagged).toBe(false);
		});
	});

	describe("T5: flags current.md per-agent sections older than stale_section_days threshold", () => {
		it("reports stale sections with sessionId + lastUpdated", () => {
			const recentTs = new Date().toISOString();
			const staleTs = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
			const content = [
				"# Operational State",
				"",
				"## Project (shared)",
				"",
				"(empty)",
				"",
				"---",
				"",
				"## Session aaaaaaaa — recent work",
				"",
				`**Session ID**: aaaaaaaa-0000-0000-0000-000000000001`,
				`**Last updated**: ${recentTs}`,
				"",
				"### In Flight",
				"",
				"recent",
				"",
				"### Open Questions",
				"",
				"(empty)",
				"",
				"### Cursor",
				"",
				"(empty)",
				"",
				"---",
				"",
				"## Session bbbbbbbb — old work",
				"",
				`**Session ID**: bbbbbbbb-0000-0000-0000-000000000002`,
				`**Last updated**: ${staleTs}`,
				"",
				"### In Flight",
				"",
				"old",
				"",
				"### Open Questions",
				"",
				"(empty)",
				"",
				"### Cursor",
				"",
				"(empty)",
				"",
				"---",
				"",
			].join("\n");
			writeCurrentMd(tmpRoot, content);

			const report = measureProjectContext(tmpRoot, { stale_section_days: 7 });

			expect(report.currentMd.exists).toBe(true);
			expect(report.currentMd.staleSections.length).toBeGreaterThanOrEqual(1);
			const stale = report.currentMd.staleSections.find((s) =>
				s.sessionId.startsWith("bbbbbbbb"),
			);
			expect(stale).toBeDefined();
			expect(stale?.lastUpdated).toBe(staleTs);
		});
	});
});
