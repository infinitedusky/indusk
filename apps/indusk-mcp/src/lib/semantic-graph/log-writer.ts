/**
 * Append-only writer for the semantic graph event log.
 *
 * v1 assumes a single writer at a time — the sync pipeline runs serialized at
 * phase boundaries and overlay capture runs sequentially inside skill
 * execution. If that assumption breaks we add a file lock or swap to a Redis
 * stream. See ADR section "Plain file storage, not Redis stream."
 */

import { mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname } from "node:path";

import { type SemanticGraphEvent, serializeEvent } from "./events.js";

export class LogWriter {
	private directoryEnsured = false;

	constructor(private readonly logPath: string) {}

	/**
	 * Append a single event to the log as one JSONL line.
	 *
	 * Creates the parent directory lazily on first write so callers don't have
	 * to bootstrap `.indusk/graph/` manually. Uses a newline terminator so the
	 * file always ends on a line boundary — important for crash safety during
	 * replay.
	 */
	async append(event: SemanticGraphEvent): Promise<void> {
		this.ensureDirectory();
		const line = `${serializeEvent(event)}\n`;
		await appendFile(this.logPath, line, "utf8");
	}

	private ensureDirectory(): void {
		if (this.directoryEnsured) return;
		mkdirSync(dirname(this.logPath), { recursive: true });
		this.directoryEnsured = true;
	}
}
