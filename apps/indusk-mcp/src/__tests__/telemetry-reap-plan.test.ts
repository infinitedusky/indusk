// clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared
// promise: the-daemon-readers-follow-is-the-one-running
import { describe, expect, it } from "vitest";
import { daemonState } from "../lib/telemetry/daemon-state.js";
import { reapPlan, runReap } from "../lib/telemetry/reap-plan.js";
import { collectorCmd, fakeReads, HOME, jaegerCmd, rec } from "./helpers/daemon-reads.js";

/**
 * A20 and the reap half of A21 — what `reap` stops, decided from reads, and
 * what it says about it. No process starts and no signal is sent: the process
 * table is a description and `kill` is a spy.
 *
 * A20: the strays of this home, whether or not their config file is still
 * there, and nothing else. A21: each stray stopped is printed, and one that
 * would not stop is named with a non-zero exit. Its report half: upheld for
 * strays-are-cleared when none remains, broken naming each that does, and
 * nothing when no daemon is recorded to receive it.
 */

const TEMP_HOME = "/tmp/someone-elses-test-home";
const OWN = [jaegerCmd(1, HOME), collectorCmd(2, HOME)];
const STRANGER_CMD = { pid: 6, startedAt: null, command: "/usr/bin/vim notes.md" };

/** The config files of every process in `rows` exist, except those of the pids in `gone`. */
function filesOf(rows: { pid: number; command: string }[], gone: number[] = []) {
	return Object.fromEntries(
		rows
			.filter((r) => !gone.includes(r.pid))
			.map((r) => [/--config=(?:file:)?(\S+)/.exec(r.command)?.[1] ?? "", { mtimeMs: 1, size: 1 }]),
	);
}

/** A process table the reap acts on: what is alive, what ends on a signal, what does not. */
function table(rows: { pid: number; command: string }[], stubborn: number[] = []) {
	const live = new Set(rows.map((r) => r.pid));
	const signals: Array<[number, string]> = [];
	const deps = {
		alive: (pid: number) => live.has(pid),
		command: (pid: number) => rows.find((r) => r.pid === pid)?.command ?? null,
		kill(pid: number, signal: NodeJS.Signals) {
			signals.push([pid, signal]);
			if (!stubborn.includes(pid)) live.delete(pid);
		},
		sleep: async () => {},
	};
	return { deps, signals };
}

describe("A20 — reap stops this home's strays and nothing else", () => {
	it("every stray of this home, config present or gone, and not the recorded daemon, another home's or a stranger's", () => {
		const processes = [
			...OWN,
			jaegerCmd(3, HOME),
			collectorCmd(4, HOME),
			jaegerCmd(5, TEMP_HOME),
			STRANGER_CMD,
		];
		const state = daemonState(
			fakeReads({ record: rec(1, 2), processes, files: filesOf(processes, [4]) }),
			HOME,
		);
		expect(reapPlan(state).map((p) => p.pid)).toEqual([3, 4]);
	});

	it("sends nothing to the recorded daemon, another home's daemon or a stranger", async () => {
		const processes = [...OWN, jaegerCmd(3, HOME), jaegerCmd(5, TEMP_HOME), STRANGER_CMD];
		const reads = fakeReads({ record: rec(1, 2), processes, files: filesOf(processes) });
		const { deps, signals } = table(processes);
		const out = await runReap(reads, HOME, deps);
		expect([...new Set(signals.map(([pid]) => pid))]).toEqual([3]);
		expect(out.code).toBe(0);
	});

	it("with no record it stops nothing and says to run `telemetry start` first", async () => {
		const processes = [jaegerCmd(3, HOME), collectorCmd(4, HOME)];
		const reads = fakeReads({ record: null, processes, files: filesOf(processes) });
		const { deps, signals } = table(processes);
		const out = await runReap(reads, HOME, deps);
		expect(signals).toEqual([]);
		expect(out.text).toMatch(/indusk telemetry start/);
		expect(out.code).toBe(0);
	});

	it("a process whose pid was recycled to a stranger since the list was read is not signalled", async () => {
		const processes = [...OWN, jaegerCmd(3, HOME)];
		const reads = fakeReads({ record: rec(1, 2), processes, files: filesOf(processes) });
		const { deps, signals } = table([
			...OWN,
			{ pid: 3, startedAt: null, command: "/usr/bin/vim notes.md" },
		] as never);
		await runReap(reads, HOME, deps);
		expect(signals).toEqual([]);
	});

	it("a dry run names the strays and signals none", async () => {
		const processes = [...OWN, jaegerCmd(3, HOME)];
		const reads = fakeReads({ record: rec(1, 2), processes, files: filesOf(processes) });
		const { deps, signals } = table(processes);
		const out = await runReap(reads, HOME, deps, { dryRun: true });
		expect(signals).toEqual([]);
		expect(out.text).toMatch(/Would stop jaeger 3/);
	});
});

describe("A21 — reap says what it stopped and what would not stop", () => {
	it("prints each stray stopped and exits non-zero naming one that would not stop", async () => {
		const processes = [...OWN, jaegerCmd(3, HOME), jaegerCmd(4, HOME)];
		const reads = fakeReads({ record: rec(1, 2), processes, files: filesOf(processes) });
		const { deps } = table(processes, [4]);
		const out = await runReap(reads, HOME, deps);
		expect(out.text).toMatch(/stopped jaeger 3/);
		expect(out.text).toMatch(/jaeger 4 would not stop/);
		expect(out.code).not.toBe(0);
	});

	it("with nothing to stop it says so and exits zero", async () => {
		const reads = fakeReads({ record: rec(1, 2), processes: OWN, files: filesOf(OWN) });
		const out = await runReap(reads, HOME, table(OWN).deps);
		expect(out.text).toMatch(/No strays/);
		expect(out.code).toBe(0);
	});

	it("reports upheld for strays-are-cleared when every stray stopped", async () => {
		const processes = [...OWN, jaegerCmd(3, HOME)];
		const reads = fakeReads({ record: rec(1, 2), processes, files: filesOf(processes) });
		const out = await runReap(reads, HOME, table(processes).deps);
		expect(out.reports).toEqual([
			expect.objectContaining({ clause: "strays-are-cleared", outcome: "upheld" }),
		]);
	});

	it("reports broken for strays-are-cleared naming each stray that would not stop", async () => {
		const processes = [...OWN, jaegerCmd(3, HOME), jaegerCmd(4, HOME)];
		const reads = fakeReads({ record: rec(1, 2), processes, files: filesOf(processes) });
		const out = await runReap(reads, HOME, table(processes, [4]).deps);
		expect(out.reports).toHaveLength(1);
		expect(out.reports[0]).toMatchObject({ clause: "strays-are-cleared", outcome: "broken" });
		expect(out.reports[0]?.symptom).toMatch(/^strays-are-cleared: .*jaeger 4/);
		expect(out.reports[0]?.symptom).not.toMatch(/jaeger 3/);
	});

	it("with nothing to stop it reports upheld", async () => {
		const reads = fakeReads({ record: rec(1, 2), processes: OWN, files: filesOf(OWN) });
		const out = await runReap(reads, HOME, table(OWN).deps);
		expect(out.reports.map((r) => r.outcome)).toEqual(["upheld"]);
	});

	it("with no record there is no daemon to receive a report, so none is made", async () => {
		const processes = [jaegerCmd(3, HOME), collectorCmd(4, HOME)];
		const reads = fakeReads({ record: null, processes, files: filesOf(processes) });
		const out = await runReap(reads, HOME, table(processes).deps);
		expect(out.reports).toEqual([]);
	});
});
