/**
 * Streaming reader for the semantic graph event log.
 *
 * Yields validated events line-by-line. Malformed lines (bad JSON or schema
 * mismatch) are not thrown — they are surfaced via the `onMalformed` callback
 * so replay can skip and log rather than aborting mid-file. Corruption at EOF
 * from a crashed writer is survivable this way.
 */

import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { createInterface } from "node:readline";

import { parseEvent, type SemanticGraphEvent } from "./events.js";

export interface LogReaderOptions {
	/** Called for each line that fails to parse. Replay should log and skip. */
	onMalformed?: (line: string, error: Error, lineNumber: number) => void;
}

/**
 * Read events from a log file as an async iterator.
 *
 * If the file does not exist, yields nothing (no error) — fresh projects start
 * with an empty log.
 */
export async function* readEvents(
	logPath: string,
	options: LogReaderOptions = {},
): AsyncGenerator<SemanticGraphEvent> {
	if (!existsSync(logPath)) return;

	const handle = await open(logPath, "r");
	try {
		const stream = handle.createReadStream({ encoding: "utf8" });
		const rl = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });

		let lineNumber = 0;
		for await (const line of rl) {
			lineNumber++;
			if (line.length === 0) continue;
			try {
				yield parseEvent(line);
			} catch (err) {
				options.onMalformed?.(line, err as Error, lineNumber);
			}
		}
	} finally {
		await handle.close();
	}
}

/** Collect all events into an array. Convenient for tests and small logs. */
export async function readAllEvents(
	logPath: string,
	options: LogReaderOptions = {},
): Promise<SemanticGraphEvent[]> {
	const events: SemanticGraphEvent[] = [];
	for await (const event of readEvents(logPath, options)) {
		events.push(event);
	}
	return events;
}
