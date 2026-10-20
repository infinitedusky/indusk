// clause: admin-pages-load-fast/kept-briefly
// clause: admin-pages-load-fast/one-read-per-page
// promise: a-run-is-read-from-its-record
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PsRow } from "../process-identity.js";
import {
	type Exec,
	processReadsFromTable,
	readLandings,
	trunkMergeSubjectsAsync,
} from "./async-reads.js";
import {
	forgetKept,
	KEPT_CEILING_MS,
	KEPT_FOR_MS,
	keptRead,
	keptWindow,
	resetKept,
} from "./kept-reads.js";
import { runStatus } from "./liveness.js";
import { startRunRecord } from "./record.js";

/**
 * A7–A11, A17, A20 (kept reads), A25–A27: the reading is kept per key for a window, shared while
 * in flight, never kept when it failed, and bounded. Time and the read are inputs; no program starts.
 */

beforeEach(() => resetKept());

/** A clock the test moves, and a read that counts how often it ran. */
function rig() {
	let t = 1_000_000;
	const read = vi.fn(async () => `reading-${read.mock.calls.length}`);
	return {
		now: () => t,
		advance: (ms: number) => {
			t += ms;
		},
		read,
	};
}

describe("A7 — two page loads a second apart read once between them", () => {
	it("A7 the second load reuses the first reading", async () => {
		const r = rig();
		const first = await keptRead("ps", r.read, { now: r.now });
		r.advance(1000);
		const second = await keptRead("ps", r.read, { now: r.now });
		expect(r.read).toHaveBeenCalledTimes(1);
		expect(first.reused).toBe(false);
		expect(second).toMatchObject({ value: first.value, reused: true, ageMs: 1000 });
	});

	it("A7 the window is a few seconds that follows the five-second live refresh", () => {
		expect(KEPT_FOR_MS).toBeGreaterThan(5000);
		expect(KEPT_FOR_MS).toBeLessThanOrEqual(KEPT_CEILING_MS);
	});
});

describe("A8 — after the window both read fresh", () => {
	it("A8 a load after the window reads again", async () => {
		const r = rig();
		await keptRead("ps", r.read, { now: r.now });
		r.advance(KEPT_FOR_MS + 1);
		const again = await keptRead("ps", r.read, { now: r.now });
		expect(r.read).toHaveBeenCalledTimes(2);
		expect(again).toMatchObject({ reused: false, ageMs: 0, refreshedEarly: false });
	});

	it("A8 a run whose process has since died reads stopped on the load after the window", async () => {
		const r = rig();
		const startedAt = "2026-10-19T10:00:00.000Z";
		const row: PsRow = { pid: process.pid, startedAt, command: "claude --print" };
		let table: PsRow[] = [row];
		const readTable = async () => table;
		const record = {
			...startRunRecord("p", "build", startedAt),
			process: { pid: process.pid, bin: "claude", startedAt },
		};
		const status = async () => {
			const got = await keptRead("ps", readTable, { now: r.now });
			return runStatus(record, processReadsFromTable(got.value), false, undefined);
		};
		expect((await status()).state).toBe("running");
		// the process dies; inside the window the old reading still says running
		table = [];
		r.advance(1000);
		expect((await status()).state).toBe("running");
		r.advance(KEPT_FOR_MS);
		// the window has passed: read fresh, the pid is alive here but the table has no row for it
		expect((await status()).state).not.toBe("running");
	});
});

describe("A9 — simultaneous loads on a cold start read once", () => {
	it("A9 five loads at once share one read", async () => {
		const r = rig();
		let release: (v: string) => void = () => {};
		const slow = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					release = resolve;
				}),
		);
		const loads = Array.from({ length: 5 }, () => keptRead("ps", slow, { now: r.now }));
		release("table");
		const got = await Promise.all(loads);
		expect(slow).toHaveBeenCalledTimes(1);
		expect(got.map((g) => g.value)).toEqual(Array(5).fill("table"));
	});
});

describe("A10 — a failed read is never kept", () => {
	it("A10 the next load tries again at once and does not reuse the failure", async () => {
		const r = rig();
		const read = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("ps failed"))
			.mockResolvedValueOnce("table");
		await expect(keptRead("ps", read, { now: r.now })).rejects.toThrow("ps failed");
		const next = await keptRead("ps", read, { now: r.now });
		expect(read).toHaveBeenCalledTimes(2);
		expect(next).toMatchObject({ value: "table", reused: false });
	});

	it("A10 loads that were waiting on the failed read all see the failure, then a new load reads again", async () => {
		const r = rig();
		let fail: (e: Error) => void = () => {};
		const read = vi
			.fn<() => Promise<string>>()
			.mockImplementationOnce(
				() =>
					new Promise((_, reject) => {
						fail = reject;
					}),
			)
			.mockResolvedValueOnce("ok");
		const a = keptRead("ps", read, { now: r.now });
		const b = keptRead("ps", read, { now: r.now });
		fail(new Error("boom"));
		await expect(a).rejects.toThrow("boom");
		await expect(b).rejects.toThrow("boom");
		expect((await keptRead("ps", read, { now: r.now })).value).toBe("ok");
	});
});

describe("A11 — two projects never share a reading", () => {
	it("A11 each key reads its own value", async () => {
		const r = rig();
		const a = await keptRead("landings:/a\0main", async () => ["Merge plan/x: x landed"], {
			now: r.now,
		});
		const b = await keptRead("landings:/b\0main", async () => [] as string[], { now: r.now });
		expect(a.value).toEqual(["Merge plan/x: x landed"]);
		expect(b.value).toEqual([]);
	});

	it("forgetKept(prefix) drops only the keys under it", async () => {
		const r = rig();
		await keptRead("ps", r.read, { now: r.now });
		await keptRead("landings:/a", r.read, { now: r.now });
		forgetKept("landings:");
		await keptRead("ps", r.read, { now: r.now });
		await keptRead("landings:/a", r.read, { now: r.now });
		expect(r.read).toHaveBeenCalledTimes(3);
	});

	it("a reading forgotten while its read is under way is not stored when it ends", async () => {
		const r = rig();
		let release: (v: string) => void = () => {};
		const slow = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					release = resolve;
				}),
		);
		const first = keptRead("ps", slow, { now: r.now });
		forgetKept("ps");
		release("old");
		await first;
		const again = await keptRead("ps", r.read, { now: r.now });
		expect(again.reused).toBe(false);
	});
});

describe("A17 — a run that dies reads stopped on the next load after the window, one alive still reads running", () => {
	const startedAt = "2026-10-19T10:00:00.000Z";
	const record = (pid: number) => ({
		...startRunRecord("p", "build", startedAt),
		process: { pid, bin: "claude", startedAt },
	});

	it("A17 a live run whose row is in the table reads running", async () => {
		const table: PsRow[] = [{ pid: process.pid, startedAt, command: "/bin/claude --print" }];
		expect(runStatus(record(process.pid), processReadsFromTable(table), false).state).toBe(
			"running",
		);
	});

	it("A17 a dead process reads stopped whatever the table says", () => {
		const table: PsRow[] = [{ pid: 2_999_999, startedAt, command: "/bin/claude --print" }];
		expect(runStatus(record(2_999_999), processReadsFromTable(table), false).state).toBe("stopped");
	});
});

describe("A20 — a run started after the table was read never reads stopped", () => {
	const startedAt = "2026-10-19T10:00:00.000Z";
	const record = {
		...startRunRecord("p", "build", startedAt),
		process: { pid: process.pid, bin: "claude", startedAt },
	};

	it("A20 a pid that is alive but absent from the kept table reads unknown", () => {
		const status = runStatus(record, processReadsFromTable([]), false);
		expect(status.state).toBe("unknown");
	});

	it("A20 forgetting the kept table makes the next load read it fresh", async () => {
		const r = rig();
		await keptRead("ps", r.read, { now: r.now });
		forgetKept("ps");
		const next = await keptRead("ps", r.read, { now: r.now });
		expect(next.reused).toBe(false);
	});
});

describe("A26 — the window is clamped to the ceiling", () => {
	it("A26 a 60-second refresh gets the ceiling, a short one the floor, a middle one 1.5x", () => {
		expect(keptWindow(60_000)).toBe(KEPT_CEILING_MS);
		expect(keptWindow(1000)).toBe(KEPT_FOR_MS);
		expect(keptWindow(6000)).toBe(9000);
		expect(keptWindow(10_000)).toBe(KEPT_CEILING_MS);
		expect(keptWindow(undefined)).toBe(KEPT_FOR_MS);
	});

	it("A26 a window above the ceiling is clamped, so a dead run reads fresh within the ceiling", async () => {
		const r = rig();
		await keptRead("ps", r.read, { now: r.now, forMs: 60_000 });
		r.advance(KEPT_CEILING_MS - 1);
		expect((await keptRead("ps", r.read, { now: r.now, forMs: 60_000 })).reused).toBe(true);
		r.advance(2);
		expect((await keptRead("ps", r.read, { now: r.now, forMs: 60_000 })).reused).toBe(false);
	});

	it("a clock that runs backwards is read as a window that is not holding", async () => {
		const r = rig();
		await keptRead("ps", r.read, { now: r.now });
		r.advance(-5000);
		const again = await keptRead("ps", r.read, { now: r.now });
		expect(again).toMatchObject({ reused: false, refreshedEarly: true });
	});
});

describe("A25 — a git log and a git ls-tree that never answer stop waiting", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("A25 the page reads the plan as not landed once the time limit passes", async () => {
		const exec: Exec = (_file, args) => {
			// a branch listing answers; every log and ls-tree hangs
			if (args[0] === "branch" || args[0] === "rev-parse") return Promise.resolve("main\n");
			return new Promise<string>(() => {});
		};
		const landed = readLandings("/project", { exec, now: () => Date.now() });
		await vi.advanceTimersByTimeAsync(10_000);
		const asks = await landed;
		expect(asks("p")).toBe(false);
	});
});

describe("A27 — the landing reader and the merge-subjects reader share one read", () => {
	it("A27 a page makes one git log --merges", async () => {
		const logs: string[][] = [];
		const exec: Exec = async (_file, args) => {
			if (args[0] === "log") {
				logs.push(args);
				return "Merge plan/p: p landed\n";
			}
			if (args[0] === "branch") return "main\n";
			return "";
		};
		const deps = { exec, now: () => 1_000 };
		const asks = await readLandings("/project", deps);
		const subjects = await trunkMergeSubjectsAsync("/project", deps);
		expect(asks("p")).toBe(true);
		expect(subjects).toContain("Merge plan/p: p landed");
		expect(logs.filter((a) => a.includes("--merges"))).toHaveLength(1);
	});
});
