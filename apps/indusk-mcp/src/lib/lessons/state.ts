import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { citedTokens } from "../promises/citations.js";
import { anyTokenPattern } from "../tokens.js";

/**
 * A lesson's state, derived on every read and never stored (context-tiers,
 * ADR D3).
 *
 * A lesson is **guarded** when some enforcer in the project names it with
 * `lesson: <name>` — a test's assertion message, a hook's refusal line — so
 * the rule reaches the agent at the moment it is broken, and **advisory**
 * when nothing does. The scan is the promise citation's: the files git knows
 * about, prose skipped, so a guide or the lesson's own body never guards.
 *
 * Guarded is relative to the project scanned. A community lesson guarded only
 * by a unit test in this repository reads advisory in a consumer, whose tree
 * has no such test; a hook-carried token travels with the hook and is guarded
 * everywhere. `guardedBy` says which kind each enforcer is.
 */

export const LESSONS_REL_DIR = ".claude/lessons";

export const GUARD_KINDS = ["hook", "test", "code"] as const;
export type GuardKind = (typeof GUARD_KINDS)[number];

export interface LessonGuard {
	/** Repo-root-relative path of the file carrying the token. */
	file: string;
	kind: GuardKind;
}

export const LESSON_STATES = ["guarded", "advisory"] as const;
export type LessonStateName = (typeof LESSON_STATES)[number];

export interface LessonFile {
	/** The name a token cites: the file name without `.md`. */
	name: string;
	file: string;
	path: string;
	type: "community" | "personal";
	title: string;
}

export interface LessonState extends LessonFile {
	state: LessonStateName;
	guardedBy: LessonGuard[];
}

/** Hooks guard every project they are installed in; tests and code guard the one they live in. */
export function guardKind(rel: string): GuardKind {
	if (rel.startsWith(".claude/hooks/") || /(^|\/)hooks\//.test(rel)) return "hook";
	if (/\.test\.[cm]?[jt]sx?$/.test(rel) || /(^|\/)(__tests__|e2e)\//.test(rel)) return "test";
	return "code";
}

/** The lessons on disk, titles read from each file's H1. Empty when there is no directory. */
export function listLessonFiles(projectRoot: string): LessonFile[] {
	const dir = join(projectRoot, LESSONS_REL_DIR);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.map((file) => {
			const path = join(dir, file);
			const firstLine = readFileSync(path, "utf-8")
				.split("\n")
				.find((l) => l.startsWith("# "));
			return {
				name: file.slice(0, -".md".length),
				file,
				path,
				type: file.startsWith("community-") ? "community" : "personal",
				title: firstLine?.replace("# ", "") ?? file,
			};
		});
}

/**
 * Every lesson with its derived state. Throws when the project cannot be
 * scanned (not a git repository): the caller says so rather than reporting
 * every lesson advisory, which would be a verdict nobody reached.
 */
export async function lessonStates(projectRoot: string): Promise<LessonState[]> {
	const cited = await citedTokens(projectRoot, () => anyTokenPattern("lesson"));
	return listLessonFiles(projectRoot).map((lesson) => {
		const guardedBy = (cited.get(lesson.name) ?? [])
			.map((file) => ({ file, kind: guardKind(file) }))
			.sort((a, b) => a.file.localeCompare(b.file));
		return { ...lesson, state: guardedBy.length > 0 ? "guarded" : "advisory", guardedBy };
	});
}
