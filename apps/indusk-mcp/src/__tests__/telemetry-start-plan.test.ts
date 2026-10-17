// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
// promise: the-daemon-readers-follow-is-the-one-running
import { describe, expect, it, vi } from "vitest";
import { PORT_BLOCK, type StoredAddress } from "../lib/telemetry/daemon-address.js";
import { daemonState, renderStatus } from "../lib/telemetry/daemon-state.js";
import {
	type Candidate,
	ensureDaemon,
	restartPorts,
	type StartState,
	startPlan,
	startReport,
} from "../lib/telemetry/start-plan.js";
import {
	BLOCK,
	collectorCmd,
	fakeReads,
	HOME,
	jaegerCmd,
	ON_BLOCK,
	rec,
} from "./helpers/daemon-reads.js";

/**
 * A1, A5, A11, A12 — what a start does, decided from what is running, the
 * stored address and what holds its ports, over `DaemonReads` and a spawn
 * spy: no socket opens and no process starts.
 */

const STORED: StoredAddress = { ...PORT_BLOCK, picked: [] };
const OWN = [jaegerCmd(1, HOME), collectorCmd(2, HOME)];
const OLD: Record<number, number[]> = { 1: [4318, 16686, 62843], 2: [62841] };
const noHolders = () => ({});
const none = (): StartState => ({ kind: "none" });
const found = (candidates: Candidate[]): StartState => ({ kind: "found", candidates });
const onBlock = (jaegerPid: number, otelcolPid: number): Candidate => ({
	jaegerPid,
	otelcolPid,
	tracesPort: PORT_BLOCK.traces,
});
const onOther = (jaegerPid: number, otelcolPid: number): Candidate => ({
	jaegerPid,
	otelcolPid,
	tracesPort: 4318,
});

function spawnSpy() {
	return vi.fn(async () => rec(901, 902));
}

describe("A1 — the first start gives the daemon InDusk's own block and stores it", () => {
	it("no address stored, the block free: start on the block and store it", () => {
		expect(PORT_BLOCK).toEqual({ traces: 24318, logs: 24319, ui: 24316, mcp: 24317 });
		expect(startPlan(none(), noHolders(), HOME, { address: null })).toEqual({
			kind: "start",
			ports: PORT_BLOCK,
			store: { ...PORT_BLOCK, picked: [] },
		});
	});

	it("status prints all four ports", () => {
		const state = daemonState(
			fakeReads({ record: rec(1, 2), address: STORED, processes: OWN, listening: ON_BLOCK }),
			HOME,
		);
		expect(renderStatus(state, {}).join("\n")).toMatch(/24318.*24319.*24316.*24317/s);
	});

	it("a start in the real home with nothing running stores the address it chose, then spawns on it", async () => {
		const reads = fakeReads({ record: null, address: null });
		const spawn = spawnSpy();
		const result = await ensureDaemon("start", reads, HOME, spawn);
		expect(result.kind).toBe("started");
		expect(reads.addressWrites.map((w) => w.address)).toEqual([STORED]);
		expect(spawn).toHaveBeenCalledWith({ ports: PORT_BLOCK });
	});
});

describe("A5 — a daemon on ports other than the stored address is named, and restart moves it", () => {
	it("status names each port that differs; restart brings it onto the stored address", () => {
		const state = daemonState(
			fakeReads({
				record: rec(1, 2, { otlpPort: 4318, uiPort: 16686, mcpPort: 62843, logsOtlpPort: 62841 }),
				address: STORED,
				processes: OWN,
				listening: OLD,
			}),
			HOME,
		);
		expect(renderStatus(state, {}).join("\n")).toMatch(
			/traces on 4318 \(expected 24318\).*MCP on 62843 \(expected 24317\).*logs on 62841 \(expected 24319\)/s,
		);
		expect(restartPorts(state, HOME)).toEqual(PORT_BLOCK);
	});
});

describe("A11 — the record lost, an own daemon on its stored address: take it over", () => {
	it("takes it over, starts nothing, exits zero, and prints the takeover", async () => {
		const reads = fakeReads({
			record: null,
			address: STORED,
			processes: OWN,
			listening: ON_BLOCK,
			yaml: { ports: BLOCK, mtimeAfterStart: false },
		});
		const spawn = spawnSpy();
		const out = startReport(await ensureDaemon("start", reads, HOME, spawn));
		expect(out.code).toBe(0);
		expect(out.text).toMatch(
			/took over the running daemon: jaeger 1, otelcol 2 on 24318, 24319, 24316, 24317/,
		);
		expect(spawn).not.toHaveBeenCalled();
		expect(reads.record()).toMatchObject({ jaegerPid: 1, otelcolPid: 2 });
	});
});

describe("A12 — several own daemons and no record", () => {
	it("take the one on the stored traces port, list the rest as strays", () => {
		expect(
			startPlan(found([onBlock(1, 2), onOther(3, 4)]), noHolders(), HOME, { address: STORED }),
		).toMatchObject({ kind: "takeover", tracesPort: 24318, strays: [3, 4] });
	});

	it("none on the stored traces port: take none, start nothing, list them all", () => {
		expect(
			startPlan(found([onOther(1, 2), onOther(3, 4)]), noHolders(), HOME, { address: STORED }),
		).toMatchObject({ kind: "refuse-several", listed: [1, 2, 3, 4] });
	});

	it("start reports the strays it listed and exits zero after a takeover", async () => {
		const reads = fakeReads({
			record: null,
			address: STORED,
			processes: [...OWN, jaegerCmd(3, HOME), collectorCmd(4, HOME)],
			listening: { ...ON_BLOCK, 3: [4318, 16686], 4: [62841] },
			yaml: { ports: BLOCK, mtimeAfterStart: false },
		});
		const out = startReport(await ensureDaemon("start", reads, HOME, spawnSpy()));
		expect(out.code).toBe(0);
		expect(out.text).toMatch(/strays.*3.*4.*reap/s);
	});
});
