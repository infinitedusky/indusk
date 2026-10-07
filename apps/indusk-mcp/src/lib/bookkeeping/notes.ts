import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSection } from "../agents/current-md.js";
import { parseCurrentMd, upsertSection } from "../agents/current-md.js";
import { withLock } from "../agents/lock.js";

export type NoteCommit = { committed: true } | { committed: false; reason: string };

export function commitNote(_trunk: string, _paths: string[], _message: string): NoteCommit {
	return { committed: false, reason: "not yet" };
}

export interface CurrentSectionInput {
	sessionId: string;
	task: string;
	inFlight: string;
	openQuestions: string;
	cursor: string;
}

/** Write one session's section of `current.md`. */
export function writeCurrentSection(
	projectRoot: string,
	input: CurrentSectionInput,
): { section: AgentSection; commit: NoteCommit } {
	const path = join(projectRoot, ".indusk/current.md");
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
	let section!: AgentSection;
	withLock(`${path}.lock`, () => {
		const initial = existsSync(path) ? readFileSync(path, "utf-8") : "";
		const existing = parseCurrentMd(initial).sections.find((s) => s.sessionId === input.sessionId);
		section = {
			sessionId: input.sessionId,
			sessionShort: input.sessionId.slice(0, 8),
			task: input.task,
			lastUpdated: new Date().toISOString(),
			inFlight: input.inFlight,
			openQuestions: input.openQuestions,
			cursor: input.cursor,
			branch: existing?.branch ?? "",
			worktree: existing?.worktree ?? "",
		};
		const tmpPath = `${path}.tmp.${input.sessionId}`;
		writeFileSync(tmpPath, upsertSection(initial, section));
		renameSync(tmpPath, path);
	});
	return { section, commit: { committed: false, reason: "not yet" } };
}

export interface LessonInput {
	name: string;
	title: string;
	content: string;
}

/** Add a lesson; refuses one that already exists. */
export function addLesson(
	projectRoot: string,
	input: LessonInput,
): { file: string; commit: NoteCommit } | { error: string } {
	const dir = join(projectRoot, ".claude", "lessons");
	mkdirSync(dir, { recursive: true });
	const fileName = input.name.startsWith("community-")
		? input.name.replace("community-", "")
		: input.name;
	const file = join(dir, `${fileName}.md`);
	if (existsSync(file)) return { error: `Lesson ${fileName}.md already exists` };
	writeFileSync(file, `# ${input.title}\n\n${input.content}\n`);
	return { file, commit: { committed: false, reason: "not yet" } };
}
