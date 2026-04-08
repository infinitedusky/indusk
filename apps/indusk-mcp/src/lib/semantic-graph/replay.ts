/**
 * Replay engine — reconstruct the runtime graph from the event log.
 *
 * The log is the canonical state. The runtime graph in FalkorDB is a
 * projection. This function reads events from the log in order and applies
 * each one to the runtime client, with optional jj-ancestry filtering so
 * branches and abandoned changes don't leak into the current view.
 *
 * See ADR decision #1 (event-sourced state) and #2 (jj change IDs as the
 * time axis). The replay pattern is load-bearing: `indusk graph rebuild`
 * blows away the runtime and calls this to reconstruct it.
 */

import { readEvents } from "./log-reader.js";
import type { SemanticGraphClient } from "./runtime-client.js";

export interface ReplayOptions {
	/**
	 * Optional set of jj change IDs. If provided, only events whose
	 * `change_id` is in this set are applied — everything else is skipped.
	 * Pass the output of `getReachableChangeIds(cwd)` to get ancestry-aware
	 * replay for the current jj HEAD.
	 */
	ancestryFilter?: Set<string>;

	/**
	 * Called when an event fails to apply. The error is swallowed and replay
	 * continues — this is a design choice: one bad event should not abort the
	 * whole rebuild. Defaults to console.error.
	 */
	onError?: (error: Error, lineNumber: number) => void;

	/**
	 * Called when a line in the log fails to parse (malformed JSON or schema
	 * mismatch). Defaults to console.error. Replay counts these as errors but
	 * continues past them.
	 */
	onMalformed?: (line: string, error: Error, lineNumber: number) => void;
}

export interface ReplayResult {
	/** Number of events observed in the log (including malformed + filtered). */
	total: number;
	/** Number of events successfully applied to the runtime. */
	applied: number;
	/** Number of events skipped because of the ancestry filter. */
	skipped: number;
	/** Number of events that failed — either malformed or failed to apply. */
	errors: number;
}

/**
 * Replay events from a log file into a runtime graph client.
 *
 * Caller is responsible for calling `client.ensureConnection()` before
 * replay. Caller decides whether to `client.clearGraph()` first (for a full
 * rebuild) or not (for an incremental catch-up).
 */
export async function replay(
	logPath: string,
	client: SemanticGraphClient,
	options: ReplayOptions = {},
): Promise<ReplayResult> {
	const result: ReplayResult = { total: 0, applied: 0, skipped: 0, errors: 0 };
	let lineNumber = 0;

	const onMalformed = (line: string, err: Error, ln: number) => {
		result.total++;
		result.errors++;
		if (options.onMalformed) {
			options.onMalformed(line, err, ln);
		} else {
			console.error(`[replay] malformed line ${ln}: ${err.message}`);
		}
	};

	for await (const event of readEvents(logPath, { onMalformed })) {
		lineNumber++;
		result.total++;

		// Ancestry filter: if provided, skip events not reachable from HEAD
		if (options.ancestryFilter && !options.ancestryFilter.has(event.change_id)) {
			result.skipped++;
			continue;
		}

		try {
			await client.applyEvent(event);
			result.applied++;
		} catch (err) {
			result.errors++;
			const error = err instanceof Error ? err : new Error(String(err));
			if (options.onError) {
				options.onError(error, lineNumber);
			} else {
				console.error(`[replay] event ${lineNumber} (${event.type}) failed:`, error.message);
			}
		}
	}

	return result;
}
