// clause: a-run-is-read-from-its-record/dead-reads-stopped
import { type ChildProcess, spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { realProcessReads } from "../lib/process-identity.js";
import { runStatus } from "../lib/run-record/liveness.js";
import { type RunRecord, startRunRecord } from "../lib/run-record/record.js";

/**
 * A73: liveness against a real child and the real process table. The unit rows
 * inject their reads; this one proves the start time `ps` reports is the one a
 * record written just after spawn matches, however long after the run began.
 */

let child: ChildProcess | null = null;
afterEach(() => {
	child?.kill("SIGKILL");
	child = null;
});

async function until(check: () => boolean, ms = 5000): Promise<void> {
	const end = Date.now() + ms;
	while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
}

describe("A73 — a real child recorded as a run's process", () => {
	it("A73 reads running while it lives, minutes after the run began, and stopped once killed", async () => {
		child = spawn(process.execPath, ["-e", "setTimeout(()=>{},120000)"], { stdio: "ignore" });
		const pid = child.pid as number;
		await until(() => realProcessReads.startTime(pid) !== null);
		const startedAt = (realProcessReads.startTime(pid) as Date).toISOString();
		const record: RunRecord = {
			...startRunRecord("p", "build", new Date(Date.now() - 10 * 60_000).toISOString()),
			process: { pid, bin: process.execPath, startedAt },
		};
		expect(runStatus(record, realProcessReads, false)).toEqual({ state: "running" });

		const exited = new Promise((r) => child?.once("exit", r));
		child.kill("SIGKILL");
		await exited;
		await until(() => !realProcessReads.alive(pid));
		expect(runStatus(record, realProcessReads, false).state).toBe("stopped");
	});
});
