import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StartedEvent } from "../session/start.js";
import type { ProjectDraft } from "./store.js";

/**
 * A project conversation's transcript (new-project-flow, ADR decision 9): the
 * session's events appended to the draft as `transcript.jsonl`, one JSON object
 * per line, so a reopened conversation shows its turns with no agent running -
 * the session manager replays a running session's events and a stopped one
 * replays nothing. It is part of the draft: discarding the draft removes it,
 * and accepting reads it for the span's conversation figures before the draft
 * is deleted.
 *
 * promise: a-project-conversation-is-a-back-and-forth
 */

/** Marks where one session's events begin, so a page connected to it can tell its replay from what is kept. */
export interface SessionMarker {
	type: "session";
	id: string;
}

/** The person opened a reply's working ("See more"): expectation 5 counts these. */
export interface FoldOpened {
	type: "fold-opened";
	at: string;
}

export type TranscriptLine = StartedEvent | SessionMarker | FoldOpened;

export const transcriptPath = (draft: ProjectDraft): string => join(draft.dir, "transcript.jsonl");

/**
 * Append one line. A draft that is already gone (discarded while the agent was
 * stopping) is not an error and is never recreated: nothing is written.
 */
export function appendTranscript(draft: ProjectDraft, line: TranscriptLine): void {
	try {
		appendFileSync(transcriptPath(draft), `${JSON.stringify(line)}\n`);
	} catch {
		// The folder was removed under us; the conversation is discarded.
	}
}

export const recordFoldOpened = (draft: ProjectDraft, now: Date = new Date()): void =>
	appendTranscript(draft, { type: "fold-opened", at: now.toISOString() });

/** Every line kept, in order; a line that is not JSON is skipped, never fatal. */
export function readTranscript(draft: ProjectDraft): TranscriptLine[] {
	let text: string;
	try {
		text = readFileSync(transcriptPath(draft), "utf-8");
	} catch {
		return [];
	}
	const lines: TranscriptLine[] = [];
	for (const raw of text.split("\n")) {
		if (!raw.trim()) continue;
		try {
			const line = JSON.parse(raw) as TranscriptLine;
			if (line && typeof line.type === "string") lines.push(line);
		} catch {
			// A half-written last line is not a reason to lose the rest.
		}
	}
	return lines;
}

/** What a finished conversation measured, for the creation span (new-project-flow expectations 2 and 5). */
export interface ConversationFigures {
	/** Questions the agent asked: its `AskUserQuestion` questions plus each `?` in its replies. */
	questions: number;
	/** Agent replies: the last text of each agent turn. */
	replies: number;
	/** Mean words per reply, rounded; 0 when there were none. */
	replyWords: number;
	/** Times the person opened a reply's working. */
	foldsOpened: number;
}

const wordsIn = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** `?` outside inline code: a question asked in the agent's words. */
const questionMarks = (text: string): number =>
	(text.replace(/`[^`]*`/g, "").match(/\?/g) ?? []).length;

/**
 * The figures of a conversation, read from its transcript. A reply is the
 * last text before a turn ends (a `result`, the person speaking, or a new
 * session); the same reading the admin's thread makes of the events, counted
 * here without drawing them.
 */
export function conversationFigures(lines: readonly TranscriptLine[]): ConversationFigures {
	const replies: string[] = [];
	let last: string | null = null;
	let toolQuestions = 0;
	let foldsOpened = 0;
	const endTurn = () => {
		if (last !== null) replies.push(last);
		last = null;
	};
	for (const line of lines) {
		if (line.type === "text") last = line.text;
		else if (line.type === "result" || line.type === "you" || line.type === "session") endTurn();
		else if (line.type === "question") toolQuestions += line.questions.length;
		else if (line.type === "fold-opened") foldsOpened++;
	}
	endTurn();
	const words = replies.reduce((sum, r) => sum + wordsIn(r), 0);
	return {
		questions: toolQuestions + replies.reduce((sum, r) => sum + questionMarks(r), 0),
		replies: replies.length,
		replyWords: replies.length === 0 ? 0 : Math.round(words / replies.length),
		foldsOpened,
	};
}
