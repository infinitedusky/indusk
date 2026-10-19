// clause: landing-tests-hold-under-load/recorder-waits-for-its-break
// lesson: everyday-tests-never-wait
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startRecorderLoops } from "./recorder-loop.js";
import {
	readScanRecords,
	recordPassOutcome,
	type ScanRecord,
	scanFinishedAfter,
	writeScanRecord,
} from "./scan-record.js";

/**
 * a-run-can-be-trusted A89: the recorder loop writes each pass's start, end and outcome to its
 * scan record, and a pass that throws is recorded as not finished. Time is faked.
 */

const PROD = "/projects/with-production";
let loops: { stop(): void } | null = null;
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
});
afterEach(() => {
	loops?.stop();
	loops = null;
	vi.useRealTimers();
});

describe("A89 — the loop writes down each scan", () => {
	it("records a pass's start, end and ok outcome, and a thrown pass as not finished", async () => {
		const records: Array<[string, ScanRecord]> = [];
		const record = vi
			.fn<(root: string) => Promise<unknown>>()
			.mockImplementationOnce(async () => {
				await new Promise((r) => setTimeout(r, 2_000));
			})
			.mockRejectedValueOnce(new Error("jaeger query timed out"));
		loops = startRecorderLoops({
			projects: () => [PROD],
			hasProduction: () => true,
			intervalFor: () => 5_000,
			record,
			scanRecord: (root, scan) => records.push([root, scan]),
			log: () => {},
		});
		await vi.advanceTimersByTimeAsync(10_000);
		expect(records).toEqual([
			[PROD, { startedAt: 1_005_000, endedAt: 1_007_000, ok: true }],
			[
				PROD,
				{ startedAt: 1_010_000, endedAt: 1_010_000, ok: false, error: "jaeger query timed out" },
			],
		]);
		expect(scanFinishedAfter(records[0][1], 1_000_000)).toBe(true);
		expect(scanFinishedAfter(records[0][1], 1_005_000)).toBe(false);
		expect(scanFinishedAfter(records[1][1], 1_000_000)).toBe(false);
	});

	it("a record that cannot be written is logged and the loop goes on", async () => {
		const lines: string[] = [];
		const record = vi.fn(async () => {});
		loops = startRecorderLoops({
			projects: () => [PROD],
			hasProduction: () => true,
			intervalFor: () => 5_000,
			record,
			scanRecord: () => {
				throw new Error("disk full");
			},
			log: (l) => lines.push(l),
		});
		await vi.advanceTimersByTimeAsync(10_000);
		expect(record).toHaveBeenCalledTimes(2);
		expect(lines.join("\n")).toMatch(/disk full/);
	});

	/**
	 * A102 (a-run-can-be-trusted, Build Phase 7, falsification): `recordBreaks` never throws when
	 * the production read fails; it resolves with `error` set. Such a pass did not scan, so it is
	 * written not finished, and the patient landing test goes on waiting.
	 */
	it("A102 a pass that resolved with a failed production read is recorded as not finished", async () => {
		const records: Array<[string, ScanRecord]> = [];
		const record = vi
			.fn<(root: string) => Promise<unknown>>()
			.mockResolvedValueOnce({ error: new Error("jaeger query timed out after 10s") })
			.mockResolvedValueOnce({ refused: "names no production source" })
			.mockResolvedValueOnce({ changes: [] });
		loops = startRecorderLoops({
			projects: () => [PROD],
			hasProduction: () => true,
			intervalFor: () => 5_000,
			record,
			outcomeOf: (result: unknown) => {
				const r = result as { error?: Error; refused?: string };
				if (r?.error) return { ok: false, error: r.error.message };
				if (r?.refused) return { ok: false, error: r.refused };
				return { ok: true };
			},
			scanRecord: (root, scan) => records.push([root, scan]),
			log: () => {},
		} as Parameters<typeof startRecorderLoops>[0]);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(records.map(([, s]) => [s.ok, s.error])).toEqual([
			[false, "jaeger query timed out after 10s"],
			[false, "names no production source"],
			[true, undefined],
		]);
		expect(scanFinishedAfter(records[0][1], 1_000_000)).toBe(false);
	});

	it("A102 the package's outcome of a recordBreaks result, which the admin hands the loop, says the same", () => {
		expect(recordPassOutcome({ error: new Error("jaeger query timed out") })).toEqual({
			ok: false,
			error: "jaeger query timed out",
		});
		expect(recordPassOutcome({ refused: "names no production source" })).toEqual({
			ok: false,
			error: "names no production source",
		});
		expect(recordPassOutcome({ changes: [] })).toEqual({ ok: true });
		expect(recordPassOutcome(undefined)).toEqual({ ok: true });
	});

	it("the record file is written whole, per project, with no temp file left", () => {
		vi.useRealTimers();
		const home = mkdtempSync(join(tmpdir(), "scan-record-"));
		try {
			writeScanRecord(PROD, { startedAt: 1, endedAt: 2, ok: true }, home);
			writeScanRecord("/other", { startedAt: 3, endedAt: 4, ok: false, error: "x" }, home);
			writeScanRecord(PROD, { startedAt: 5, endedAt: 6, ok: true }, home);
			expect(readScanRecords(home)).toEqual({
				[PROD]: { startedAt: 5, endedAt: 6, ok: true },
				"/other": { startedAt: 3, endedAt: 4, ok: false, error: "x" },
			});
			expect(readdirSync(home)).toEqual(["recorder-scan.json"]);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});
});

// promise: landing-tests-hold-under-load
