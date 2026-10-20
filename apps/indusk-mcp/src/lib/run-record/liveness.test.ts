// clause: a-run-is-read-from-its-record/dead-reads-stopped
import { describe, expect, it } from "vitest";
import type { ProcessDeps } from "../process-identity.js";
import { runStatus } from "./liveness.js";
import { type RunRecord, startRunRecord } from "./record.js";

const STARTED = "2026-10-19T10:00:00.000Z";

const record = (over: Partial<RunRecord> = {}): RunRecord => ({
	...startRunRecord("p", "build", "2026-10-19T09:00:00.000Z"),
	process: { pid: 4242, bin: "claude", startedAt: STARTED },
	...over,
});

const deps = (over: Partial<ProcessDeps> = {}): ProcessDeps => ({
	alive: () => true,
	command: () => "/usr/local/bin/claude --print",
	startTime: () => new Date(STARTED),
	...over,
});

describe("A7 — a run whose process is gone with no stop reads stopped", () => {
	it("A7 reads stopped, saying the run's process is gone", () => {
		const status = runStatus(record(), deps({ alive: () => false }), false);
		expect(status).toEqual({ state: "stopped", reason: expect.stringContaining("gone") });
	});

	it("A7 a run with no process recorded and nothing holding it reads stopped the same way", () => {
		const status = runStatus(record({ process: null }), deps(), false);
		expect(status).toEqual({ state: "stopped", reason: expect.stringContaining("gone") });
	});

	it("A7 a run that stopped on its own reads stopped with the reason it wrote", () => {
		const status = runStatus(
			record({ stop: { step: "amendment" }, stopReason: "an amendment waits" }),
			deps(),
			false,
		);
		expect(status).toEqual({ state: "stopped", reason: "an amendment waits" });
	});
});

describe("A8 — a recorded pid that is now another program reads stopped", () => {
	it("A8 a recorded pid that is now a different program reads stopped", () => {
		const status = runStatus(record(), deps({ command: () => "/usr/bin/vim notes.txt" }), false);
		expect(status).toEqual({ state: "stopped", reason: expect.stringContaining("gone") });
	});

	it("A8 a recycled pid that started at another time reads stopped", () => {
		const status = runStatus(
			record(),
			deps({ startTime: () => new Date("2026-10-19T10:30:00.000Z") }),
			false,
		);
		expect(status.state).toBe("stopped");
	});
});

describe("A9 — a live step session reads running however long after the admin started", () => {
	it("A9 alive, the right program, the recorded start: running, minutes after the run began", () => {
		const status = runStatus(record(), deps(), false);
		expect(status).toEqual({ state: "running" });
	});

	it("A9 the gap between two step sessions reads running while this daemon holds the run", () => {
		expect(runStatus(record({ process: null }), deps({ alive: () => false }), true)).toEqual({
			state: "running",
		});
	});
});

describe("A10 — after the admin restarts, the step session decides, never the admin's own process", () => {
	it("A10 asks about the recorded step-session pid and no other", () => {
		const asked: number[] = [];
		const status = runStatus(
			record(),
			deps({
				alive: (pid) => {
					asked.push(pid);
					return true;
				},
			}),
			false,
		);
		expect(status.state).toBe("running");
		expect(asked.length).toBeGreaterThan(0);
		expect(new Set(asked)).toEqual(new Set([4242]));
		expect(asked).not.toContain(process.pid);
	});
});

describe("A5 — a record that could not be read is unknown, never running", () => {
	it("A5 unknown and absent records read unknown", () => {
		expect(runStatus("unknown", deps(), true).state).toBe("unknown");
		expect(runStatus(null, deps(), false).state).toBe("unknown");
	});
});

// promise: a-run-is-read-from-its-record
