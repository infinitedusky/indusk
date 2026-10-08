import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The project's inbox (incident-recording, ADR D5): what the recorder has to
 * tell a running session, kept in the project's home. One JSON line per break
 * or reminder; a second file lists the ids already delivered, so delivering
 * is an append and never a rewrite of what the recorder may be appending to.
 * The prompt hook (`hooks/break-inbox.js`) reads it; the VS Code extension
 * will read the same file.
 *
 * promise: a-break-reaches-the-working-agent
 */

export const INBOX_FILE = "inbox.jsonl";
export const DELIVERED_FILE = "inbox-delivered.jsonl";

export interface InboxEntry {
	id: string;
	/** When it was written, ISO. */
	at: string;
	kind: "break" | "reminder";
	promise: string;
	incident: string;
	owner: string;
	/** The owner's Maintenance phase name, e.g. `Maintenance — i-…`. */
	phase: string;
}

export type InboxNews = Omit<InboxEntry, "id" | "at">;

export function appendInbox(home: string, news: InboxNews[], now: Date): void {
	if (news.length === 0) return;
	mkdirSync(home, { recursive: true });
	const lines = news.map((n) => JSON.stringify({ id: randomUUID(), at: now.toISOString(), ...n }));
	appendFileSync(join(home, INBOX_FILE), `${lines.join("\n")}\n`);
}

export interface InboxRead {
	entries: InboxEntry[];
	/** Lines that could not be read, each with its line number: said, never skipped. */
	problems: string[];
}

/** Every entry no session has been given yet. */
export function undelivered(home: string): InboxRead {
	const inbox = readLines(join(home, INBOX_FILE));
	const delivered = new Set(
		readLines(join(home, DELIVERED_FILE)).values.map((v) => (v as { id?: string }).id),
	);
	return {
		entries: (inbox.values as InboxEntry[]).filter((e) => !delivered.has(e.id)),
		problems: inbox.problems,
	};
}

export function markDelivered(home: string, ids: string[]): void {
	if (ids.length === 0) return;
	appendFileSync(
		join(home, DELIVERED_FILE),
		`${ids.map((id) => JSON.stringify({ id })).join("\n")}\n`,
	);
}

function readLines(path: string): { values: unknown[]; problems: string[] } {
	if (!existsSync(path)) return { values: [], problems: [] };
	const values: unknown[] = [];
	const problems: string[] = [];
	readFileSync(path, "utf-8")
		.split("\n")
		.forEach((line, i) => {
			if (!line.trim()) return;
			try {
				values.push(JSON.parse(line));
			} catch {
				problems.push(`${path}:${i + 1} is not JSON`);
			}
		});
	return { values, problems };
}
