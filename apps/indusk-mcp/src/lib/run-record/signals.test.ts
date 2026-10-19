// clause: a-run-is-read-from-its-record/kept-on-disk
// clause: a-run-is-read-from-its-record/dead-reads-stopped
// clause: a-run-is-read-from-its-record/never-in-progress-when-idle
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PsRow } from "../process-identity.js";
import { captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import { type RunRecord, runRecordPath, startRunRecord, writeRunRecord } from "./record.js";
import {
	judgeDeadReadsStopped,
	judgeKeptOnDisk,
	judgeNotInProgressWhenIdle,
	reportDeadReadsStopped,
	reportKeptOnDisk,
	reportNotInProgressWhenIdle,
} from "./signals.js";

const STARTED = "2026-10-19T10:00:00.000Z";
const record = (over: Partial<RunRecord> = {}): RunRecord => ({
	...startRunRecord("p", "build", STARTED),
	process: { pid: 4242, bin: "claude", startedAt: STARTED },
	...over,
});
const row = (pid: number, startedAt: string | null = STARTED): PsRow => ({
	pid,
	startedAt,
	command: "claude",
});

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "run-signals-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("kept-on-disk", () => {
	it("reports upheld when the file read back says what the run says", async () => {
		const run = record({ step: "work", phase: "Build Phase 1" });
		writeRunRecord(home, run);
		const { tracer, spans } = captureTracer();
		await reportKeptOnDisk("/p", home, run, tracer);
		expect(outcomesByClause(spans)).toEqual({ "kept-on-disk": "upheld" });
	});

	it("reports broken, naming the plan, when the file differs or is gone", async () => {
		const run = record({ step: "work" });
		writeRunRecord(home, { ...run, step: "falsify" });
		const { tracer, spans } = captureTracer();
		await reportKeptOnDisk("/p", home, run, tracer);
		expect(outcomesByClause(spans)).toEqual({ "kept-on-disk": "broken" });
		expect(judgeKeptOnDisk(run, null)).toMatch(/p build record differs/);
	});

	it("reports broken for a file cut off", async () => {
		const run = record();
		const path = runRecordPath(home, "p", "build");
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, "{");
		const { tracer, spans } = captureTracer();
		await reportKeptOnDisk("/p", home, run, tracer);
		expect(outcomesByClause(spans)["kept-on-disk"]).toBe("broken");
	});
});

describe("dead-reads-stopped", () => {
	it("is upheld when a run read stopped has no process, or one read running has", () => {
		const base = { heldHere: false };
		expect(
			judgeDeadReadsStopped({ ...base, record: record(), shown: "stopped", table: [] }),
		).toEqual({
			promise: "a-run-is-read-from-its-record",
			clause: "dead-reads-stopped",
		});
		expect(
			judgeDeadReadsStopped({ ...base, record: record(), shown: "running", table: [row(4242)] })
				?.broken,
		).toBeUndefined();
	});

	it("is broken when a live step session was read as stopped", () => {
		const verdict = judgeDeadReadsStopped({
			heldHere: false,
			record: record(),
			shown: "stopped",
			table: [row(4242)],
		});
		expect(verdict?.broken).toMatch(/p read stopped, but its step session 4242 is running/);
	});

	it("is broken when a run read running has no process and nothing holds it", () => {
		const verdict = judgeDeadReadsStopped({
			heldHere: false,
			record: record(),
			shown: "running",
			table: [row(1)],
		});
		expect(verdict?.broken).toMatch(/no process 4242 lives/);
	});

	it("a pid the table shows started at another time is not the run's process", () => {
		const verdict = judgeDeadReadsStopped({
			heldHere: false,
			record: record(),
			shown: "stopped",
			table: [row(4242, "2026-10-19T12:00:00.000Z")],
		});
		expect(verdict?.broken).toBeUndefined();
	});

	it("judges nothing for a record with no process, and writes nothing", async () => {
		const { tracer, spans } = captureTracer();
		await reportDeadReadsStopped(
			"/p",
			{ heldHere: false, record: record({ process: null }), shown: "stopped", table: [] },
			tracer,
		);
		expect(spans).toHaveLength(0);
	});

	it("writes the verdict it judged", async () => {
		const { tracer, spans } = captureTracer();
		await reportDeadReadsStopped(
			"/p",
			{ heldHere: false, record: record(), shown: "stopped", table: [row(4242)] },
			tracer,
		);
		expect(outcomesByClause(spans)).toEqual({ "dead-reads-stopped": "broken" });
	});
});

describe("never-in-progress-when-idle", () => {
	const input = { plan: "p", kind: "build" as const, heldHere: false };
	it("is upheld by this daemon's own running entry", () => {
		expect(
			judgeNotInProgressWhenIdle({ ...input, heldHere: true, sessions: [], table: [] }).broken,
		).toBeUndefined();
	});

	it("is upheld by a held session whose process the table shows", () => {
		expect(
			judgeNotInProgressWhenIdle({
				...input,
				sessions: [{ pid: 4242, startedAt: STARTED }],
				table: [row(4242)],
			}).broken,
		).toBeUndefined();
	});

	it("is broken, naming the plan and what was shown, when neither holds", async () => {
		const verdict = judgeNotInProgressWhenIdle({
			...input,
			sessions: [{ pid: 4242, startedAt: STARTED }],
			table: [],
		});
		expect(verdict.broken).toBe("p read as in progress (build) with no process running for it");
		const { tracer, spans } = captureTracer();
		await reportNotInProgressWhenIdle("/p", { ...input, sessions: [], table: [] }, tracer);
		expect(outcomesByClause(spans)).toEqual({ "never-in-progress-when-idle": "broken" });
	});
});
