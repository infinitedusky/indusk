/**
 * Reader for the eval results log.
 *
 * Same pattern as the semantic graph log reader — streaming, malformed line
 * handling via callback, yields nothing for missing files.
 */

import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { createInterface } from "node:readline";

import { type EvalLogEntry, isScorecard } from "./types.js";

export interface EvalLogReaderOptions {
	onMalformed?: (line: string, error: Error, lineNumber: number) => void;
	mode?: "eval" | "baseline";
	since?: Date;
	changeId?: string;
}

export async function* readEntries(
	logPath: string,
	options: EvalLogReaderOptions = {},
): AsyncGenerator<EvalLogEntry> {
	if (!existsSync(logPath)) return;

	const handle = await open(logPath, "r");
	try {
		const stream = handle.createReadStream({ encoding: "utf8" });
		const rl = createInterface({
			input: stream,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		let lineNumber = 0;
		for await (const line of rl) {
			lineNumber++;
			if (line.length === 0) continue;

			let entry: EvalLogEntry;
			try {
				entry = JSON.parse(line) as EvalLogEntry;
			} catch (err) {
				options.onMalformed?.(line, err as Error, lineNumber);
				continue;
			}

			if (options.mode && isScorecard(entry) && entry.mode !== options.mode) continue;
			if (options.since && new Date(entry.timestamp) < options.since) continue;
			if (options.changeId && entry.changeId !== options.changeId) continue;

			yield entry;
		}
	} finally {
		await handle.close();
	}
}

export async function readAllEntries(
	logPath: string,
	options: EvalLogReaderOptions = {},
): Promise<EvalLogEntry[]> {
	const entries: EvalLogEntry[] = [];
	for await (const entry of readEntries(logPath, options)) {
		entries.push(entry);
	}
	return entries;
}
