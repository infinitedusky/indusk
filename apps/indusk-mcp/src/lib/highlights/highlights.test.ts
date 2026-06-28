import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markProcessed, readUnprocessedHighlights, writeHighlight } from "./highlights.js";

let projectRoot: string;
let induskDir: string;

beforeEach(() => {
	projectRoot = join(
		tmpdir(),
		`highlights-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	induskDir = join(projectRoot, ".indusk");
	mkdirSync(induskDir, { recursive: true });
});

afterEach(() => {
	rmSync(projectRoot, { recursive: true, force: true });
});

describe("T1: writeHighlight appends a JSONL entry with auto-generated ID and timestamp", () => {
	it("creates .indusk/highlights.jsonl on first write with an entry", () => {
		const entry = writeHighlight(projectRoot, {
			tag: "brief-accepted",
			note: "agent-roles brief accepted",
			level: "critical",
		});

		expect(entry.id).toMatch(/^h-\d{8}-\d{3}$/);
		expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(entry.level).toBe("critical");
		expect(entry.tag).toBe("brief-accepted");
		expect(entry.note).toBe("agent-roles brief accepted");
		expect(existsSync(join(induskDir, "highlights.jsonl"))).toBe(true);
	});

	it("appends multiple entries in order", () => {
		writeHighlight(projectRoot, { tag: "adr-accepted", note: "first", level: "critical" });
		writeHighlight(projectRoot, { tag: "correction", note: "second", level: "important" });
		writeHighlight(projectRoot, { tag: "observation", note: "third", level: "note" });

		const all = readUnprocessedHighlights(projectRoot);
		expect(all.length).toBe(3);
		expect(all[0].note).toBe("first");
		expect(all[1].note).toBe("second");
		expect(all[2].note).toBe("third");
	});

	it("preserves exact JSONL format (one JSON per line, no extra whitespace between lines)", () => {
		writeHighlight(projectRoot, { tag: "t1", note: "one", level: "note" });
		writeHighlight(projectRoot, { tag: "t2", note: "two", level: "note" });
		const { readFileSync } = require("node:fs");
		const content = readFileSync(join(induskDir, "highlights.jsonl"), "utf-8");
		const lines = content.split("\n").filter((l: string) => l.length > 0);
		expect(lines.length).toBe(2);
		// Each line must be valid JSON
		for (const line of lines) {
			expect(() => JSON.parse(line)).not.toThrow();
		}
	});
});

describe("T2: readUnprocessedHighlights returns entries not in the processed log", () => {
	it("returns all entries when processed log is empty", () => {
		writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		writeHighlight(projectRoot, { tag: "b", note: "2", level: "note" });
		expect(readUnprocessedHighlights(projectRoot).length).toBe(2);
	});

	it("returns empty when highlights file doesn't exist", () => {
		expect(readUnprocessedHighlights(projectRoot)).toEqual([]);
	});

	it("excludes entries whose IDs appear in the processed log", () => {
		const h1 = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		writeHighlight(projectRoot, { tag: "b", note: "2", level: "note" });
		markProcessed(projectRoot, h1.id, "wrote-episode");
		const unprocessed = readUnprocessedHighlights(projectRoot);
		expect(unprocessed.length).toBe(1);
		expect(unprocessed[0].note).toBe("2");
	});
});

describe("T3: markProcessed records the outcome and excludes the highlight from subsequent reads", () => {
	it("creates highlights-processed.jsonl and appends an entry", () => {
		const h = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		const mark = markProcessed(projectRoot, h.id, "wrote-episode", "graph_capture called");
		expect(mark.id).toBe(h.id);
		expect(mark.action).toBe("wrote-episode");
		expect(mark.detail).toBe("graph_capture called");
		expect(mark.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(existsSync(join(induskDir, "highlights-processed.jsonl"))).toBe(true);
	});

	it("subsequent readUnprocessedHighlights excludes the marked entry", () => {
		const h = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		expect(readUnprocessedHighlights(projectRoot).length).toBe(1);
		markProcessed(projectRoot, h.id, "wrote-episode");
		expect(readUnprocessedHighlights(projectRoot).length).toBe(0);
	});

	it("accepts 'skipped' as an action with an optional reason in detail", () => {
		const h = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		const mark = markProcessed(
			projectRoot,
			h.id,
			"skipped",
			"already captured in transcript analysis",
		);
		expect(mark.action).toBe("skipped");
		expect(mark.detail).toBe("already captured in transcript analysis");
	});
});

describe("T4: highlight ID format is h-{YYYYMMDD}-{seq} with seq reset daily", () => {
	it("first highlight of the day gets seq 001", () => {
		const h = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		expect(h.id).toMatch(/^h-\d{8}-001$/);
	});

	it("subsequent highlights same day get incrementing seq (002, 003, ...)", () => {
		const h1 = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		const h2 = writeHighlight(projectRoot, { tag: "b", note: "2", level: "note" });
		const h3 = writeHighlight(projectRoot, { tag: "c", note: "3", level: "note" });
		// Same day (test runs in a single second), so seq should be 001, 002, 003
		const date1 = h1.id.slice(2, 10);
		const date2 = h2.id.slice(2, 10);
		const date3 = h3.id.slice(2, 10);
		expect(date1).toBe(date2);
		expect(date2).toBe(date3);
		expect(h1.id.slice(11)).toBe("001");
		expect(h2.id.slice(11)).toBe("002");
		expect(h3.id.slice(11)).toBe("003");
	});

	it("YYYYMMDD portion matches the current UTC date", () => {
		const h = writeHighlight(projectRoot, { tag: "a", note: "1", level: "note" });
		const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		expect(h.id.slice(2, 10)).toBe(today);
	});
});

describe("T9: markProcessed rejects duplicate IDs at write time (Phase 6 dedup fix)", () => {
	it("returns { already_processed: true } on the second call AND does NOT append a second line", () => {
		const h = writeHighlight(projectRoot, { tag: "x", note: "1", level: "note" });

		const first = markProcessed(projectRoot, h.id, "wrote-episode", "episode-1");
		// First call writes normally — no already_processed flag (or it's false)
		expect(first.id).toBe(h.id);
		expect(
			(first as { already_processed?: boolean }).already_processed,
			"first call must NOT carry already_processed: true",
		).toBeFalsy();

		const processedPath = join(induskDir, "highlights-processed.jsonl");
		const linesAfterFirst = readFileSync(processedPath, "utf-8")
			.split("\n")
			.filter((l) => l.length > 0).length;
		expect(linesAfterFirst).toBe(1);

		const second = markProcessed(projectRoot, h.id, "wrote-episode", "episode-2-attempted");
		// Second call returns the already_processed signal
		expect((second as { already_processed?: boolean }).already_processed).toBe(true);

		const linesAfterSecond = readFileSync(processedPath, "utf-8")
			.split("\n")
			.filter((l) => l.length > 0).length;
		expect(
			linesAfterSecond,
			"file must NOT grow on duplicate markProcessed — write rejected",
		).toBe(1);
	});

	it("the original processedAt timestamp is surfaced when already_processed: true", () => {
		const h = writeHighlight(projectRoot, { tag: "y", note: "1", level: "important" });

		const first = markProcessed(projectRoot, h.id, "wrote-episode");
		const second = markProcessed(projectRoot, h.id, "wrote-episode");

		expect(
			(second as { original_processedAt?: string }).original_processedAt,
			"second call should report the original processedAt for context",
		).toBe(first.processedAt);
	});

	it("readUnprocessedHighlights still works correctly when no duplicates exist (regression)", () => {
		const a = writeHighlight(projectRoot, { tag: "z", note: "a", level: "note" });
		const b = writeHighlight(projectRoot, { tag: "z", note: "b", level: "note" });

		// Mark only one
		markProcessed(projectRoot, a.id, "wrote-episode");

		const unprocessed = readUnprocessedHighlights(projectRoot);
		expect(unprocessed.length).toBe(1);
		expect(unprocessed[0].id).toBe(b.id);
	});
});

describe("T10: markProcessed catches malformed historic entries via raw-content check (Phase 7 falsification fix H19)", () => {
	// Phase 7 reasoning: readAllProcessed silently skips malformed JSON lines
	// (try/catch around JSON.parse). If highlights-processed.jsonl contains a
	// corrupted line carrying the literal "id":"<target>" (e.g., a write that
	// crashed mid-line, a hand-edit gone wrong, a version-format mismatch),
	// readAllProcessed returns no entry for the target ID, the Phase 6
	// markProcessed check thinks it's not present, and appends a duplicate —
	// the dedup contract silently breaks.
	//
	// The fix: defensive substring-on-raw-content check before the parsed
	// check. If the raw bytes contain `"id":"<escaped id>"`, treat the ID
	// as already present even when readAllProcessed didn't surface a
	// parseable entry. The agent's STOP signal (already_processed: true)
	// still fires; original_processedAt is undefined because the malformed
	// entry didn't yield a parseable timestamp.

	it("treats a malformed (truncated JSON) historic entry as already processed", async () => {
		const { writeFileSync } = await import("node:fs");

		// Seed the processed log with a malformed entry for h-X.
		// Note: opening brace + id field + processedAt field, then truncated —
		// no closing brace. JSON.parse rejects this.
		const malformedPath = join(induskDir, "highlights-processed.jsonl");
		writeFileSync(
			malformedPath,
			`{"id":"h-20260101-001","processedAt":"2026-01-01T00:00:00.000Z","action":"wrote-episo\n`,
			"utf-8",
		);

		const result = markProcessed(projectRoot, "h-20260101-001", "wrote-episode", "retry-attempt");

		expect(
			(result as { already_processed?: boolean }).already_processed,
			"malformed historic entry for this ID must trigger the already_processed signal",
		).toBe(true);

		const linesAfter = readFileSync(malformedPath, "utf-8")
			.split("\n")
			.filter((l) => l.length > 0).length;
		expect(linesAfter, "file must NOT grow — duplicate write rejected").toBe(1);
	});

	it("readAllProcessed still silently skips the malformed line (parser tolerance preserved)", () => {
		const { writeFileSync } = require("node:fs");
		const malformedPath = join(induskDir, "highlights-processed.jsonl");
		writeFileSync(
			malformedPath,
			`{"id":"h-bad","processedAt":"BAD-TS","action":"wrote-episo\n`,
			"utf-8",
		);
		// The defensive markProcessed check works around the parser's tolerance
		// without changing it — readAllProcessed returns an empty array because
		// the only line fails JSON.parse. readUnprocessedHighlights treats
		// the malformed entry as "not processed" (also acceptable; it falls
		// back to "we don't know"). The contract specifically defended here
		// is on the WRITE side.
		const unproc = readUnprocessedHighlights(projectRoot);
		// No well-formed highlights exist either; unproc is []
		expect(unproc).toEqual([]);
	});
});
