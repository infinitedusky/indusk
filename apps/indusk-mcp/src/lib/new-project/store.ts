import { randomBytes } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { isUsableSegment } from "../path-segment.js";

/**
 * Project drafts (new-project-flow, ADR decision 1): a conversation that may
 * become a project. A draft is a folder under the machine's InDusk home -
 * `<home>/new-projects/<id>/` - because the project it is about does not exist
 * yet, so there is no checkout, no workbench and no bookkeeping home to hold
 * it. Everything the conversation writes is in that folder: `draft.json` (the
 * first message), `documents/` (what the person added), `brief.md`,
 * `research.md` and, last, `proposal.json`. Nothing about a draft is written
 * anywhere else until a person accepts the proposal.
 *
 * promise: an-unkept-project-conversation-leaves-nothing-on-disk
 */

/** A document the person adds, by the name it keeps in the draft. */
export interface DraftDocument {
	name: string;
	content: string | Buffer;
}

export interface ProjectDraft {
	id: string;
	/** `<home>/new-projects/<id>`. */
	dir: string;
}

/** What a draft's page and its session prompt read of the conversation so far. */
export interface ProjectDraftView extends ProjectDraft {
	/** What the person said first. */
	message: string;
	/** The names of the documents added, sorted. */
	documents: string[];
	/** The founding brief the agent has written, or null. */
	brief: string | null;
	hasProposal: boolean;
}

const MARKER = "draft.json";

export const newProjectsDir = (home: string): string => join(home, "new-projects");

export const documentsDir = (draft: ProjectDraft): string => join(draft.dir, "documents");

/**
 * The name a document keeps: the last segment of what the person's file was
 * called. Anything that could not be joined into the documents folder as one
 * clean segment is refused, never repaired.
 */
export function documentName(name: string): string {
	const clean = basename(name);
	if (!isUsableSegment(clean)) throw new Error(`"${name}" is not a document name`);
	return clean;
}

/**
 * A new draft holding the person's first message and any documents they
 * brought. Documents land in `documents/` exactly as given (the same name
 * twice keeps the later one; `addDocument` is the call that reports the
 * difference).
 */
export function createProjectDraft(
	home: string,
	input: { message: string; documents?: DraftDocument[] },
	now: Date = new Date(),
): ProjectDraft {
	const id = `${now.getTime().toString(36)}-${randomBytes(3).toString("hex")}`;
	const draft: ProjectDraft = { id, dir: join(newProjectsDir(home), id) };
	mkdirSync(documentsDir(draft), { recursive: true });
	for (const doc of input.documents ?? []) {
		writeFileSync(join(documentsDir(draft), documentName(doc.name)), doc.content);
	}
	writeFileSync(
		join(draft.dir, MARKER),
		`${JSON.stringify({ id, created: now.toISOString(), message: input.message })}\n`,
	);
	return draft;
}

/** The draft `id`, or null when there is none (an id is one clean segment, never a path). */
export function findProjectDraft(home: string, id: string): ProjectDraft | null {
	if (!isUsableSegment(id)) return null;
	const dir = join(newProjectsDir(home), id);
	return existsSync(join(dir, MARKER)) ? { id, dir } : null;
}

function readText(path: string): string | null {
	try {
		const text = readFileSync(path, "utf-8");
		return text.trim() === "" ? null : text;
	} catch {
		return null;
	}
}

/** What the conversation holds so far; null when there is no such draft. */
export function readProjectDraft(home: string, id: string): ProjectDraftView | null {
	const draft = findProjectDraft(home, id);
	if (!draft) return null;
	let message = "";
	try {
		const raw = JSON.parse(readFileSync(join(draft.dir, MARKER), "utf-8")) as {
			message?: unknown;
		};
		if (typeof raw.message === "string") message = raw.message;
	} catch {
		// An unreadable marker still names a draft; the first message is lost, not the draft.
	}
	const docs = documentsDir(draft);
	return {
		...draft,
		message,
		documents: existsSync(docs) ? readdirSync(docs).sort() : [],
		brief: readText(join(draft.dir, "brief.md")),
		hasProposal: existsSync(join(draft.dir, "proposal.json")),
	};
}

/** When the person opened the conversation (the draft's first message), or null when the marker cannot say. */
export function projectDraftCreatedAt(draft: ProjectDraft): Date | null {
	try {
		const raw = JSON.parse(readFileSync(join(draft.dir, MARKER), "utf-8")) as { created?: unknown };
		const at = typeof raw.created === "string" ? new Date(raw.created) : null;
		return at && !Number.isNaN(at.getTime()) ? at : null;
	} catch {
		return null;
	}
}

/** Mark the draft as talked in just now. */
export function touchProjectDraft(draft: ProjectDraft, now: Date = new Date()): void {
	utimesSync(join(draft.dir, MARKER), now, now);
}

/** Throw a draft away: its folder, and nothing else. Quiet when it is already gone. */
export function discardProjectDraft(home: string, id: string): void {
	const draft = findProjectDraft(home, id);
	if (draft) rmSync(draft.dir, { recursive: true, force: true });
}
