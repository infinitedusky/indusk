// clause: admin-pages-load-fast/never-freezes
// clause: admin-pages-load-fast/one-read-per-page
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PsRow } from "../process-identity.js";
import {
	type Exec,
	processReadsFromTable,
	READ_TIMEOUT_MS,
	readProcessTable,
	startProgram,
} from "./async-reads.js";
import { resetKept } from "./kept-reads.js";
import { runStatus } from "./liveness.js";
import { startRunRecord } from "./record.js";

/**
 * A5 and A15 (admin-pages-load-fast, Build Phase 1): a process-list read that fails or does not
 * answer leaves every live run's liveness unknown, and the page does not ask again per run.
 * The program runner is an input, so nothing here starts a program.
 */

beforeEach(() => resetKept());
afterEach(() => vi.useRealTimers());

const startedAt = "2026-10-19T10:00:00.000Z";
const runWith = (pid: number) => ({
	...startRunRecord("p", "build", startedAt),
	process: { pid, bin: "claude", startedAt },
});

describe("A5 — a failed process-list read reads every live run unknown, not stopped", () => {
	it("A5 a null table reads a run with a live process unknown", () => {
		const reads = processReadsFromTable(null);
		expect(runStatus(runWith(process.pid), reads, false).state).toBe("unknown");
	});

	it("A5 many runs on a failed read ask the table reader once, not once per run", async () => {
		const exec = vi.fn<Exec>(async () => {
			throw new Error("ps failed");
		});
		const table = await readProcessTable({ exec });
		const reads = processReadsFromTable(table);
		const states = Array.from(
			{ length: 10 },
			() => runStatus(runWith(process.pid), reads, false).state,
		);
		expect(states).toEqual(Array(10).fill("unknown"));
		expect(exec).toHaveBeenCalledTimes(1);
	});

	it("A5 a dead process still reads stopped when the table could not be read", () => {
		expect(runStatus(runWith(2_999_999), processReadsFromTable(null), false).state).toBe("stopped");
	});

	it("a table that was read holds the row's command and start time for the pid", () => {
		const table: PsRow[] = [{ pid: process.pid, startedAt, command: "/bin/claude --print" }];
		const reads = processReadsFromTable(table);
		expect(reads.command(process.pid)).toBe("/bin/claude --print");
		expect(reads.startTime(process.pid)?.toISOString()).toBe(startedAt);
		expect(reads.command(1_999_999)).toBeNull();
		expect(reads.startTime(1_999_999)).toBeNull();
	});
});

describe("A15 — a process list that never answers lets the page answer with liveness unknown", () => {
	it("A15 the read gives up at the time limit and resolves null", async () => {
		vi.useFakeTimers();
		const exec: Exec = () => new Promise<string>(() => {});
		const table = readProcessTable({ exec });
		await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
		expect(await table).toBeNull();
	});

	it("A15 the run then reads unknown", async () => {
		vi.useFakeTimers();
		const table = readProcessTable({ exec: () => new Promise<string>(() => {}) });
		await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
		const reads = processReadsFromTable(await table);
		expect(runStatus(runWith(process.pid), reads, false).state).toBe("unknown");
	});

	it("A15 the time limit is under the page's one second times three", () => {
		expect(READ_TIMEOUT_MS).toBe(3000);
	});

	it("a program that answers before the limit is read, and its timer is cleared", async () => {
		vi.useFakeTimers();
		const exec: Exec = async () =>
			`  ${process.pid} Mon Oct 19 10:00:00 2026 /bin/claude --print\n`;
		const table = await readProcessTable({ exec });
		expect(table?.[0].pid).toBe(process.pid);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe("startProgram counts every start into the request's count", () => {
	it("counts the starts made inside a counted scope", async () => {
		const { countStarts } = await import("./async-reads.js");
		const exec: Exec = async () => "";
		const { starts } = await countStarts(async () => {
			await startProgram("git", ["status"], { exec });
			await startProgram("git", ["log"], { exec });
		});
		expect(starts).toBe(2);
	});
});
