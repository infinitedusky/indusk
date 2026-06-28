import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type HighlightLevel = "critical" | "important" | "note";
export type ProcessedAction = "wrote-episode" | "skipped";

export interface Highlight {
	id: string;
	timestamp: string;
	level: HighlightLevel;
	tag: string;
	note: string;
}

export interface ProcessedMark {
	id: string;
	processedAt: string;
	action: ProcessedAction;
	detail?: string;
	/**
	 * Set to `true` when `markProcessed` was called on an ID already
	 * present in the processed log. The append was REJECTED to prevent
	 * duplicate Graphiti episodes downstream. Phase 6 dedup fix (1.31.2).
	 */
	already_processed?: boolean;
	/** Timestamp of the original processed mark, surfaced when `already_processed: true`. */
	original_processedAt?: string;
}

export interface WriteHighlightInput {
	tag: string;
	note: string;
	level: HighlightLevel;
}

function highlightsPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "highlights.jsonl");
}

function processedPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "highlights-processed.jsonl");
}

function ensureInduskDir(projectRoot: string): void {
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
}

function todayStamp(): string {
	return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Read all highlights from the JSONL queue. Returns empty array if the
 * file doesn't exist. Malformed lines are skipped with a silent warning
 * (matching the semantic-graph / falsification log resilience pattern).
 */
function readAllHighlights(projectRoot: string): Highlight[] {
	const path = highlightsPath(projectRoot);
	if (!existsSync(path)) return [];

	const content = readFileSync(path, "utf-8");
	const lines = content.split("\n").filter((l) => l.length > 0);
	const highlights: Highlight[] = [];
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			if (parsed && typeof parsed.id === "string") {
				highlights.push(parsed as Highlight);
			}
		} catch {
			// skip malformed line
		}
	}
	return highlights;
}

function readAllProcessed(projectRoot: string): ProcessedMark[] {
	const path = processedPath(projectRoot);
	if (!existsSync(path)) return [];

	const content = readFileSync(path, "utf-8");
	const lines = content.split("\n").filter((l) => l.length > 0);
	const marks: ProcessedMark[] = [];
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			if (parsed && typeof parsed.id === "string") {
				marks.push(parsed as ProcessedMark);
			}
		} catch {
			// skip malformed line
		}
	}
	return marks;
}

/**
 * Phase 7 falsification fix (H19): defensive substring check on the raw
 * file content. `readAllProcessed` silently skips malformed JSON lines
 * (try/catch around `JSON.parse`), so a corrupted historic entry carrying
 * the target ID is invisible to the parsed dedup check. This helper
 * scans the raw bytes for the literal `"id":"<escaped id>"` substring —
 * if found, the ID has been "seen" by the file even if the line is
 * unparseable. Used as a belt-and-suspenders layer on top of
 * `readAllProcessed` in `markProcessed`.
 */
function isIdInRawProcessed(projectRoot: string, id: string): boolean {
	const path = processedPath(projectRoot);
	if (!existsSync(path)) return false;
	const raw = readFileSync(path, "utf-8");
	// Escape JSON-relevant characters in the ID for the regex literal.
	// Highlight IDs are h-YYYYMMDD-NNN (alphanumeric + hyphens), so no
	// regex metacharacters in practice, but defensive escaping is cheap.
	const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`"id"\\s*:\\s*"${escaped}"`);
	return pattern.test(raw);
}

/**
 * Compute the next sequence number for today's highlights. Reads all
 * existing highlights, filters to entries whose ID starts with today's
 * date, takes max seq, adds 1. Starts at 001 if none exist for today.
 */
function nextSeqForToday(projectRoot: string): number {
	const today = todayStamp();
	const prefix = `h-${today}-`;
	const highlights = readAllHighlights(projectRoot);
	let maxSeq = 0;
	for (const h of highlights) {
		if (!h.id.startsWith(prefix)) continue;
		const seqStr = h.id.slice(prefix.length);
		const seq = Number.parseInt(seqStr, 10);
		if (!Number.isNaN(seq) && seq > maxSeq) {
			maxSeq = seq;
		}
	}
	return maxSeq + 1;
}

/**
 * Append a highlight to the plan-scoped `.indusk/highlights.jsonl` queue.
 * Called by the working agent (via the `highlight` MCP tool) at trigger
 * points — brief accepted, ADR accepted, correction confirmed, retro
 * lesson, manual `/highlight` flag. The eval agent reads these later
 * and turns them into structured Graphiti episodes.
 *
 * The ID is `h-{YYYYMMDD}-{seq}` where `seq` is a 3-digit counter that
 * resets daily. The timestamp is ISO 8601 UTC.
 */
export function writeHighlight(projectRoot: string, input: WriteHighlightInput): Highlight {
	ensureInduskDir(projectRoot);
	const seq = nextSeqForToday(projectRoot);
	const entry: Highlight = {
		id: `h-${todayStamp()}-${String(seq).padStart(3, "0")}`,
		timestamp: new Date().toISOString(),
		level: input.level,
		tag: input.tag,
		note: input.note,
	};
	appendFileSync(highlightsPath(projectRoot), `${JSON.stringify(entry)}\n`, "utf-8");
	return entry;
}

/**
 * Return all highlights whose IDs don't yet appear in the processed log.
 * Used by the eval agent (via the `highlights_unprocessed` MCP tool) to
 * find highlights that haven't been written to Graphiti yet.
 */
export function readUnprocessedHighlights(projectRoot: string): Highlight[] {
	const highlights = readAllHighlights(projectRoot);
	if (highlights.length === 0) return [];
	const processedIds = new Set(readAllProcessed(projectRoot).map((m) => m.id));
	return highlights.filter((h) => !processedIds.has(h.id));
}

/**
 * Mark a highlight as processed. Called by the eval agent (via the
 * `highlight_mark_processed` MCP tool) after handling a highlight —
 * either writing a structured Graphiti episode (`wrote-episode`) or
 * deciding the highlight doesn't warrant a new episode (`skipped`).
 *
 * **Write-time dedup (Phase 6 fix, 1.31.2)**: previously this function
 * was idempotent-append — duplicate calls for the same ID would append
 * duplicate lines, and `readUnprocessedHighlights` deduped via Set at
 * read time. T4's runtime audit (2026-06-28) showed the eval agent
 * sometimes processes highlights from session memory rather than calling
 * `highlights_unprocessed`, producing duplicate `graph_capture` writes to
 * Graphiti. The fix: check the processed log first; if the ID is present,
 * return `{ already_processed: true, original_processedAt }` WITHOUT
 * appending. The agent's tool result signals the redundancy so it can
 * skip the duplicate `graph_capture` call.
 *
 * `readUnprocessedHighlights` still uses a Set on read — defense against
 * historic duplicates already in the file from pre-1.31.2 runs.
 */
export function markProcessed(
	projectRoot: string,
	id: string,
	action: ProcessedAction,
	detail?: string,
): ProcessedMark {
	ensureInduskDir(projectRoot);

	const existing = readAllProcessed(projectRoot).find((m) => m.id === id);
	if (existing) {
		return {
			id,
			processedAt: new Date().toISOString(),
			action,
			detail,
			already_processed: true,
			original_processedAt: existing.processedAt,
		};
	}

	// Phase 7 (H19) defense: even if `readAllProcessed` returned no parseable
	// entry for this ID, the raw file may still contain a corrupted historic
	// line carrying the literal ID. Treat that as "already processed" too —
	// the parser's tolerance shouldn't silently re-open the dedup contract.
	// original_processedAt is undefined because the malformed entry didn't
	// yield a parseable timestamp; the boolean is the load-bearing signal.
	if (isIdInRawProcessed(projectRoot, id)) {
		return {
			id,
			processedAt: new Date().toISOString(),
			action,
			detail,
			already_processed: true,
		};
	}

	const mark: ProcessedMark = {
		id,
		processedAt: new Date().toISOString(),
		action,
		detail,
	};
	appendFileSync(processedPath(projectRoot), `${JSON.stringify(mark)}\n`, "utf-8");
	return mark;
}
