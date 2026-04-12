import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAllEntries } from "./log-reader.js";
import { EvalLogWriter } from "./log-writer.js";
import type { EvalErrorEntry, EvalScorecard } from "./types.js";

function makeScorecard(overrides: Partial<EvalScorecard> = {}): EvalScorecard {
	return {
		version: 1,
		timestamp: "2026-04-10T12:00:00.000Z",
		mode: "eval",
		changeId: "abc123",
		projectGroup: "dusk",
		questions: [
			{
				id: "conventions",
				question: "Did the agent follow conventions?",
				answer: "yes",
				severity: "info",
				evidence: "All conventions followed",
				finding: "No issues found",
			},
		],
		summary: "Good work",
		graphitiWrites: 0,
		telemetryPosted: false,
		...overrides,
	};
}

function makeError(overrides: Partial<EvalErrorEntry> = {}): EvalErrorEntry {
	return {
		version: 1,
		timestamp: "2026-04-10T12:00:00.000Z",
		mode: "eval",
		changeId: "abc123",
		error: true,
		message: "Judge failed to produce valid JSON",
		...overrides,
	};
}

describe("EvalLogWriter", () => {
	let tmpDir: string;
	let logPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "eval-log-"));
		logPath = join(tmpDir, ".indusk", "eval", "results.log");
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates the directory lazily on first write", async () => {
		expect(existsSync(logPath)).toBe(false);
		const writer = new EvalLogWriter(logPath);
		await writer.append(makeScorecard());
		expect(existsSync(logPath)).toBe(true);
	});

	it("writes entries as newline-terminated JSONL", async () => {
		const writer = new EvalLogWriter(logPath);
		await writer.append(makeScorecard({ changeId: "c1" }));
		await writer.append(makeScorecard({ changeId: "c2" }));

		const raw = readFileSync(logPath, "utf8");
		const lines = raw.split("\n");
		expect(lines).toHaveLength(3); // 2 entries + trailing empty
		expect(lines[2]).toBe("");
		expect(JSON.parse(lines[0] ?? "")).toMatchObject({ changeId: "c1" });
		expect(JSON.parse(lines[1] ?? "")).toMatchObject({ changeId: "c2" });
	});

	it("appends without clobbering prior contents", async () => {
		const writer1 = new EvalLogWriter(logPath);
		await writer1.append(makeScorecard({ changeId: "c1" }));

		const writer2 = new EvalLogWriter(logPath);
		await writer2.append(makeScorecard({ changeId: "c2" }));

		const raw = readFileSync(logPath, "utf8");
		expect(raw.split("\n").filter(Boolean)).toHaveLength(2);
	});
});

describe("readAllEntries", () => {
	let tmpDir: string;
	let logPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "eval-log-"));
		logPath = join(tmpDir, "results.log");
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns empty array for missing file", async () => {
		const entries = await readAllEntries(logPath);
		expect(entries).toEqual([]);
	});

	it("round-trips scorecards through writer and reader", async () => {
		const writer = new EvalLogWriter(logPath);
		const card = makeScorecard({ changeId: "round-trip" });
		await writer.append(card);

		const entries = await readAllEntries(logPath);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual(card);
	});

	it("round-trips error entries", async () => {
		const writer = new EvalLogWriter(logPath);
		const err = makeError({ changeId: "err-1" });
		await writer.append(err);

		const entries = await readAllEntries(logPath);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual(err);
	});

	it("skips malformed lines and reports via callback", async () => {
		writeFileSync(logPath, '{"valid":true}\nnot json\n{"also":"valid"}\n');

		const malformed: string[] = [];
		const entries = await readAllEntries(logPath, {
			onMalformed: (line) => malformed.push(line),
		});

		expect(entries).toHaveLength(2);
		expect(malformed).toEqual(["not json"]);
	});

	it("filters by mode", async () => {
		const writer = new EvalLogWriter(logPath);
		await writer.append(makeScorecard({ mode: "eval", changeId: "e1" }));
		await writer.append(makeScorecard({ mode: "baseline", changeId: "b1" }));
		await writer.append(makeScorecard({ mode: "eval", changeId: "e2" }));

		const entries = await readAllEntries(logPath, { mode: "baseline" });
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ changeId: "b1" });
	});

	it("filters by changeId", async () => {
		const writer = new EvalLogWriter(logPath);
		await writer.append(makeScorecard({ changeId: "target" }));
		await writer.append(makeScorecard({ changeId: "other" }));

		const entries = await readAllEntries(logPath, { changeId: "target" });
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ changeId: "target" });
	});

	it("filters by since date", async () => {
		const writer = new EvalLogWriter(logPath);
		await writer.append(makeScorecard({ timestamp: "2026-04-01T00:00:00.000Z", changeId: "old" }));
		await writer.append(makeScorecard({ timestamp: "2026-04-10T00:00:00.000Z", changeId: "new" }));

		const entries = await readAllEntries(logPath, { since: new Date("2026-04-05") });
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ changeId: "new" });
	});
});
