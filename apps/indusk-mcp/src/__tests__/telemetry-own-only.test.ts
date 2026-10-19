// a regression guard over indusk-stops-only-its-own-daemons
// promise: the-daemon-readers-follow-is-the-one-running
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PORT_BLOCK, type StoredAddress } from "../lib/telemetry/daemon-address.js";
import { candidatesOf, takeOverLocked } from "../lib/telemetry/daemon-find.js";
import { daemonProcessOf, isOwn } from "../lib/telemetry/daemon-process.js";
import { daemonState } from "../lib/telemetry/daemon-state.js";
import { reapPlan, runReap } from "../lib/telemetry/reap-plan.js";
import { startPlan, startStateOf } from "../lib/telemetry/start-plan.js";
import { type StopDeps, stopDaemon } from "../lib/telemetry/stop.js";
import { collectorCmd, fakeReads, HOME, jaegerCmd, ON_BLOCK, rec } from "./helpers/daemon-reads.js";

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
			// the temporary home is live: its config file is there (a deleted home's daemon is an orphan, which reap stops)
			files: { [`${TEMP_HOME}/telemetry-jaeger.yaml`]: { mtimeMs: 1, size: 1 } },
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

describe("A39 — a home reached through a link is the same home", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
	// A real directory, a symlink to it and a directory that is somewhere else: nothing mocked.
	let base: string;
	let real: string;
	let link: string;
	let elsewhere: string;
	beforeEach(() => {
		base = mkdtempSync(join(realpathSync(tmpdir()), "own-link-"));
		real = join(base, "real");
		elsewhere = join(base, "elsewhere");
		link = join(base, "link");
		mkdirSync(real);
		mkdirSync(elsewhere);
		symlinkSync(real, link);
	});
	afterEach(() => rmSync(base, { recursive: true, force: true }));

	const lostAt = (spelled: string) =>
		fakeReads({
			record: null,
			processes: [jaegerCmd(1, spelled), collectorCmd(2, spelled)],
			listening: ON_BLOCK,
			yaml: { mtimeAfterStart: false },
		});

	it("a process run out of the link is this home's, in either spelling", () => {
		const viaLink = daemonProcessOf(jaegerCmd(1, link).command) as NonNullable<
			ReturnType<typeof daemonProcessOf>
		>;
		const viaReal = daemonProcessOf(jaegerCmd(1, real).command) as typeof viaLink;
		expect(isOwn(viaLink, real)).toBe(true);
		expect(isOwn(viaReal, link)).toBe(true);
	});

	it("a daemon of a home that resolves elsewhere is still not this home's", () => {
		const other = daemonProcessOf(jaegerCmd(1, elsewhere).command) as NonNullable<
			ReturnType<typeof daemonProcessOf>
		>;
		expect(isOwn(other, real)).toBe(false);
		expect(isOwn(other, link)).toBe(false);
		expect(candidatesOf(lostAt(elsewhere), real)).toEqual([]);
	});

	it("is found and taken over by the exact path when it was started through the link", () => {
		const reads = lostAt(link);
		expect(daemonState(reads, real).kind).toBe("found");
		expect(candidatesOf(reads, real)).toHaveLength(1);
		expect(takeOverLocked(reads, real)?.meta).toMatchObject({ jaegerPid: 1, otelcolPid: 2 });
	});

	it("is stopped by the exact path when it was started through the link", async () => {
		const reads = lostAt(link);
		const taken = takeOverLocked(reads, real);
		expect(taken?.meta).toMatchObject({ jaegerPid: 1, otelcolPid: 2 });
		const meta = taken?.meta as NonNullable<typeof taken>["meta"];
		const live = new Set([1, 2]);
		const commands: Record<number, string> = Object.fromEntries(
			reads.processes().map((r) => [r.pid, r.command]),
		);
		const deps: StopDeps = {
			alive: (pid) => live.has(pid),
			command: (pid) => (live.has(pid) ? (commands[pid] ?? null) : null),
			kill: (pid) => void live.delete(pid),
			sleep: async () => {},
		};
		const result = await stopDaemon(meta, real, deps);
		expect(result).toMatchObject({ stopped: true, signaled: [1, 2] });
	});

	it("a stray started through the link is reaped by the exact path", async () => {
		const processes = [jaegerCmd(1, real), collectorCmd(2, real), jaegerCmd(3, link)];
		const reads = fakeReads({
			record: rec(1, 2),
			processes,
			yaml: { mtimeAfterStart: false },
		});
		expect(reapPlan(daemonState(reads, real)).map((p) => p.pid)).toEqual([3]);
		const live = new Set(processes.map((r) => r.pid));
		const signals: number[] = [];
		const deps: StopDeps = {
			alive: (pid) => live.has(pid),
			command: (pid) => processes.find((r) => r.pid === pid)?.command ?? null,
			kill: (pid) => {
				signals.push(pid);
				live.delete(pid);
			},
			sleep: async () => {},
		};
		await runReap(reads, real, deps);
		expect([...new Set(signals)]).toEqual([3]);
	});
});
