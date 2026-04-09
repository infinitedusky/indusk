/**
 * Append-only writer for the eval results log.
 *
 * Same pattern as the semantic graph log writer — lazy directory creation,
 * newline-terminated JSONL, single writer assumed.
 */

import { mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { EvalLogEntry } from "./types.js";

export class EvalLogWriter {
	private directoryEnsured = false;

	constructor(private readonly logPath: string) {}

	async append(entry: EvalLogEntry): Promise<void> {
		this.ensureDirectory();
		const line = `${JSON.stringify(entry)}\n`;
		await appendFile(this.logPath, line, "utf8");
	}

	private ensureDirectory(): void {
		if (this.directoryEnsured) return;
		mkdirSync(dirname(this.logPath), { recursive: true });
		this.directoryEnsured = true;
	}
}
