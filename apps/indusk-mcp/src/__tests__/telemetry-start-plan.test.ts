// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
// promise: the-daemon-readers-follow-is-the-one-running
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	addressFilePath,
	addressReport,
	PORT_BLOCK,
	resetAddress,
	type StoredAddress,
} from "../lib/telemetry/daemon-address.js";
import { realDaemonReads } from "../lib/telemetry/daemon-reads.js";
import { daemonState, renderStatus } from "../lib/telemetry/daemon-state.js";
import {
	type Candidate,
	ensureDaemon,
	optionsOf,
	restartPorts,
	type StartState,
	startOptions,
	startPlan,
	startReport,
	startStateOf,
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

describe("the seams a start is read through", () => {
	it("startStateOf: a running daemon, found pairs, or nothing to take over", () => {
		const state = (kind: "running" | "found" | "none") =>
			daemonState(
				fakeReads({
					record: kind === "running" ? rec(1, 2) : null,
					address: STORED,
					processes: kind === "none" ? [] : OWN,
					listening: ON_BLOCK,
				}),
				HOME,
			);
		expect(startStateOf(state("running"), [])).toEqual({ kind: "running" });
		expect(startStateOf(state("found"), [onBlock(1, 2)])).toEqual({
			kind: "found",
			candidates: [onBlock(1, 2)],
		});
		// a found process with no partner is nothing to take over
		expect(startStateOf(state("found"), [])).toEqual({ kind: "none" });
		expect(startStateOf(state("none"), [])).toEqual({ kind: "none" });
	});

	it("optionsOf is the inverse of startOptions in a temporary home", () => {
		const ports = { traces: 5000, logs: 5001, ui: 5002, mcp: 5003 };
		expect(startOptions(optionsOf(ports), "/tmp/h-1")).toEqual(ports);
	});
});

describe("A33 — a damaged address file is never taken for a missing one", () => {
	const damaged = "telemetry-address.json: the file is cut short";

	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	it("a start in the real home refuses naming the file and --reset, chooses nothing and spawns nothing", async () => {
		const reads = fakeReads({ record: null, address: null, addressProblem: damaged } as never);
		const spawn = spawnSpy();
		const result = await ensureDaemon("start", reads, HOME, spawn);
		expect(result.kind).toBe("refused");
		if (result.kind !== "refused") return;
		expect(result.text).toContain("telemetry-address.json");
		expect(result.text).toContain("indusk telemetry address --reset");
		expect(spawn).not.toHaveBeenCalled();
		expect(reads.addressWrites).toEqual([]);
	});

	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	it("`telemetry address` says it is unreadable instead of saying none is stored", () => {
		const reads = fakeReads({ address: null, addressProblem: damaged } as never);
		const out = addressReport(reads, {});
		expect(out.code).toBe(1);
		expect(out.text).toMatch(/unreadable/);
		expect(out.text).not.toMatch(/no address stored/);
	});

	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	it("--reset still chooses and writes over an unreadable file", () => {
		const reads = fakeReads({ address: null, addressProblem: damaged } as never);
		const result = resetAddress(reads, HOME);
		expect(result.ok).toBe(true);
		expect(reads.addressWrites).toHaveLength(1);
	});

	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	it("the real reads tell a cut-short file and a port that is not a number from a missing one, and write whole", () => {
		const home = mkdtempSync(join(tmpdir(), "address-file-"));
		try {
			const reads = realDaemonReads(home);
			expect(reads.addressProblem?.() ?? null).toBeNull();
			for (const body of [
				'{"traces": 243',
				JSON.stringify({ ...PORT_BLOCK, logs: "x", picked: [] }),
			]) {
				writeFileSync(addressFilePath(home), body);
				expect(reads.address()).toBeNull();
				expect(reads.addressProblem?.()).toEqual(expect.stringContaining("telemetry-address.json"));
			}
			// the exclusive write leaves a file that is there exactly as it was
			expect(reads.writeAddress({ ...PORT_BLOCK, picked: [] }, { exclusive: true })).toBe(false);
			expect(readFileSync(addressFilePath(home), "utf-8")).toContain('"logs":"x"');
			// the plain write replaces it whole, leaving no temporary file beside it
			expect(reads.writeAddress({ ...PORT_BLOCK, picked: [] }, { exclusive: false })).toBe(true);
			expect(reads.addressProblem?.() ?? null).toBeNull();
			expect(reads.address()).toEqual({ ...PORT_BLOCK, picked: [] });
			expect(readdirSync(home)).toEqual(["telemetry-address.json"]);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});
});
