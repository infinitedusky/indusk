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
