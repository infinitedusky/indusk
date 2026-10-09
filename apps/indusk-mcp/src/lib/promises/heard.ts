import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What this machine's recorder heard (incident-recording, ADR D6): one JSON
 * line per violation, in the project's home — when it happened, the promise,
 * the trace, the incident it belongs to and the source. The promise page
 * counts breaks from it, so a break is counted whether or not a page was open
 * and after the source no longer holds it. Never a trace twice.
 *
 * promise: the-admin-keeps-what-it-heard
 */

export const HEARD_FILE = "heard.jsonl";

export interface HeardRow {
	at: string;
	promise: string;
	trace: string;
	incident: string;
	source: string;
}

export function readHeard(home: string): HeardRow[] {
	const path = join(home, HEARD_FILE);
	if (!existsSync(path)) return [];
	const rows: HeardRow[] = [];
	for (const line of readFileSync(path, "utf-8").split("\n")) {
		if (!line.trim()) continue;
		try {
			rows.push(JSON.parse(line) as HeardRow);
		} catch {
			// A torn line is skipped: the record is a count, and the next pass
			// re-hears nothing it already holds.
		}
	}
	return rows;
}

/** Append the rows whose traces the record does not hold yet; returns those appended. */
export function appendHeard(home: string, rows: HeardRow[]): HeardRow[] {
	const held = new Set(readHeard(home).map((r) => r.trace));
	const fresh: HeardRow[] = [];
	for (const row of rows) {
		if (held.has(row.trace)) continue;
		held.add(row.trace);
		fresh.push(row);
	}
	if (fresh.length === 0) return [];
	mkdirSync(home, { recursive: true });
	appendFileSync(join(home, HEARD_FILE), `${fresh.map((r) => JSON.stringify(r)).join("\n")}\n`);
	return fresh;
}

/**
 * Violations per promise per bucket since `since`: bucket start (ms) → count.
 * The promise page's counts, and the record plan-cockpit's chart will draw.
 */
export function countHeard(
	rows: HeardRow[],
	opts: { since: Date; bucketMs: number },
): Map<string, Map<number, number>> {
	const out = new Map<string, Map<number, number>>();
	const from = opts.since.getTime();
	for (const row of rows) {
		const at = Date.parse(row.at);
		if (Number.isNaN(at) || at < from) continue;
		const bucket = from + Math.floor((at - from) / opts.bucketMs) * opts.bucketMs;
		const perPromise = out.get(row.promise) ?? new Map<number, number>();
		perPromise.set(bucket, (perPromise.get(bucket) ?? 0) + 1);
		out.set(row.promise, perPromise);
	}
	return out;
}
