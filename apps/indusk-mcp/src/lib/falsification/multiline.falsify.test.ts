import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendHypothesis, markTerminated, readFalsificationLog } from "./log.js";

/**
 * Falsification hypothesis (Phase 4 dogfood against this plan's own impl):
 *
 *   The log parser is line-oriented. The renderer writes user-supplied
 *   content on a single line after the bold label. A newline in any
 *   content field silently orphans everything after it during round-trip.
 *
 * Outcome chosen: fix-in-scope (Phase 5). Instead of supporting multiline
 * content, the library now rejects it at the boundary with a specific
 * error, forcing callers to sanitize or fail loudly. Round-trip fidelity
 * is guaranteed for single-line content; multiline content is explicitly
 * out of contract.
 *
 * See .indusk/planning/falsification-ritual/falsification.md for the log
 * entry recording this hypothesis and its outcome.
 */

let planRoot: string;

beforeEach(() => {
	planRoot = join(
		tmpdir(),
		`falsify-multiline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(planRoot, { recursive: true });
});

afterEach(() => {
	rmSync(planRoot, { recursive: true, force: true });
});

describe("T15: log library rejects multiline content at the boundary", () => {
	it("appendHypothesis throws on multiline hypothesis", () => {
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "first line\nsecond line",
				testPath: "t.ts",
				outcome: "fix-in-scope",
			}),
		).toThrow(/hypothesis must be single-line/);
	});

	it("appendHypothesis throws on multiline note", () => {
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "ok",
				testPath: "t.ts",
				outcome: "fix-in-scope",
				note: "first\nsecond",
			}),
		).toThrow(/note must be single-line/);
	});

	it("markTerminated throws on multiline reason", () => {
		expect(() => markTerminated(planRoot, "first\nsecond")).toThrow(/reason must be single-line/);
	});

	it("single-line content still round-trips cleanly (sanity)", () => {
		const hypothesis =
			"Concurrent writers to the same user's journal could interleave entries and corrupt recovery state.";
		const note = "Discovered while investigating the journal-append code path.";
		appendHypothesis(planRoot, {
			hypothesis,
			testPath: "apps/foo/bar.test.ts",
			outcome: "spawn-plan",
			note,
		});
		markTerminated(
			planRoot,
			"Investigated concurrent writes, partial writes, and malformed input; one hypothesis confirmed (spawn-plan); no further in-scope attack vector remained.",
		);
		const entries = readFalsificationLog(planRoot);
		expect(entries.length).toBe(2);
		expect((entries[0] as { hypothesis: string }).hypothesis).toBe(hypothesis);
		expect((entries[0] as { note?: string }).note).toBe(note);
		expect(entries[1].kind).toBe("terminator");
	});

	it("error message suggests how to sanitize", () => {
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "a\nb",
				testPath: null,
				outcome: "fix-in-scope",
			}),
		).toThrow(/single-line|collapse|'; '/);
	});

	it("rejects CR (\\r) as well as LF — JS regex treats CR as a line terminator in /m mode", () => {
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "a\rb",
				testPath: null,
				outcome: "fix-in-scope",
			}),
		).toThrow(/single-line/);
	});

	it("rejects CRLF (\\r\\n) combinations", () => {
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "Windows-style\r\nline ending",
				testPath: null,
				outcome: "fix-in-scope",
			}),
		).toThrow(/single-line/);
	});

	it("rejects Unicode line separators (U+2028, U+2029)", () => {
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "unicode LS\u2028here",
				testPath: null,
				outcome: "fix-in-scope",
			}),
		).toThrow(/single-line/);
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "unicode PS\u2029here",
				testPath: null,
				outcome: "fix-in-scope",
			}),
		).toThrow(/single-line/);
	});
});
