// a regression guard over indusk-stops-only-its-own-daemons
// promise: the-daemon-readers-follow-is-the-one-running
import { describe, expect, it } from "vitest";
import { PORT_BLOCK, type StoredAddress } from "../lib/telemetry/daemon-address.js";
import { candidatesOf, daemonState, takeOverLocked } from "../lib/telemetry/daemon-state.js";
import { reapPlan } from "../lib/telemetry/reap-plan.js";
import { startPlan, startStateOf } from "../lib/telemetry/start-plan.js";
import { type StopDeps, stopDaemon } from "../lib/telemetry/stop.js";
import { collectorCmd, fakeReads, HOME, jaegerCmd, ON_BLOCK } from "./helpers/daemon-reads.js";

/**
 * A25 — taking over and reaping judge a process by its command line. A
 * stranger on a stored port and a temporary-home daemon are never taken over
 * or reaped from the real home; after a takeover, `stop` stops that daemon and
 * says, non-zero, when a process would not stop.
 */

const STORED: StoredAddress = { ...PORT_BLOCK, picked: [] };
const TEMP_HOME = "/tmp/someone-elses-test-home";
const STRANGER = { pid: 6, command: "/usr/bin/nginx -g daemon off;" };
const OWN = [jaegerCmd(1, HOME), collectorCmd(2, HOME)];

describe("A25 — only the real home's own processes are taken over or reaped", () => {
	it("a stranger on a stored port and a temporary-home daemon are never taken over or reaped", () => {
		const reads = fakeReads({
			record: null,
			address: STORED,
			processes: [jaegerCmd(5, TEMP_HOME), { pid: 6, startedAt: null, command: STRANGER.command }],
			holders: { [PORT_BLOCK.traces]: STRANGER },
		});
		const state = daemonState(reads, HOME);
		const plan = startPlan(
			startStateOf(state, candidatesOf(reads, HOME)),
			reads.holders([PORT_BLOCK.traces]),
			HOME,
			{ address: STORED },
		);
		expect(plan.kind).toBe("refuse");
		expect(reapPlan(state)).toEqual([]);
	});

	it("after a takeover, stop stops that daemon and says non-zero if one would not stop", async () => {
		const reads = fakeReads({
			record: null,
			address: STORED,
			processes: OWN,
			listening: ON_BLOCK,
			yaml: { mtimeAfterStart: false },
		});
		// The takeover writes the record; stop then reads it back.
		const state = daemonState(reads, HOME);
		const found = candidatesOf(reads, HOME);
		expect(found).toHaveLength(1);
		expect(state.kind).toBe("found");
		const meta = takeOverLocked(reads, HOME)?.meta;
		expect(meta).toMatchObject({ jaegerPid: 1, otelcolPid: 2 });

		const live = new Set([1, 2]);
		const commands: Record<number, string> = Object.fromEntries(OWN.map((r) => [r.pid, r.command]));
		const deps: StopDeps = {
			alive: (pid) => live.has(pid),
			command: (pid) => (live.has(pid) ? (commands[pid] ?? null) : null),
			kill: (pid) => {
				if (pid !== 2) live.delete(pid);
			},
			sleep: async () => {},
		};
		const result = await stopDaemon(meta as NonNullable<typeof meta>, HOME, deps);
		expect(result).toMatchObject({ stopped: false, signaled: [1, 2], stillRunning: [2] });
		expect(result.clearRecord).toBe(false);
	});
});
