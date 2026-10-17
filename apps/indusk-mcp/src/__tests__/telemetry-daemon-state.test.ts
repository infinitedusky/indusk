// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
// promise: the-daemon-readers-follow-is-the-one-running
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { daemonState, renderStatus } from "../lib/telemetry/daemon-state.js";
import { daemonStatus } from "../lib/telemetry/status.js";
import { collectorCmd, fakeReads, GLOBAL, HOME, jaegerCmd, rec } from "./helpers/daemon-reads.js";

/**
 * A7, the stale-record half — a status read leaves a record naming processes
 * that are gone where it is.
 *
 * Before this plan `daemonStatus` deleted the record whenever it could not
 * confirm the daemon, and a slow port was indistinguishable from a dead one.
 * A record is removed by `stop` and rewritten by `start`; a read only reads.
 *
 * No socket is opened here: a dead process id fails `isAlive` before any port
 * check, and the home is a temporary directory of its own. Build Phase 1 adds
 * the slow-port cases and A19 (strays) over `daemonState` to this file.
 */

let home: string;
let originalHome: string | undefined;

/** A process id that was alive a moment ago and is not now. */
async function deadPid(): Promise<number> {
	const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
	const pid = child.pid;
	if (pid === undefined) throw new Error("could not spawn a short-lived child");
	await new Promise((resolve) => child.once("exit", resolve));
	return pid;
}

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "daemon-state-"));
	originalHome = process.env.INDUSK_HOME;
	process.env.INDUSK_HOME = home;
});

afterEach(() => {
	if (originalHome === undefined) Reflect.deleteProperty(process.env, "INDUSK_HOME");
	else process.env.INDUSK_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
});

describe("a status read never removes the record", () => {
	it("a stale record with nothing running reads not running, and stays where it is", async () => {
		const jaegerPid = await deadPid();
		const otelcolPid = await deadPid();
		writeFileSync(
			join(home, "telemetry.json"),
			JSON.stringify({
				jaegerPid,
				otelcolPid,
				otlpPort: 24318,
				uiPort: 24316,
				mcpPort: 24317,
				jaegerHealthPort: 55001,
				otelcolHealthPort: 55002,
				logsOtlpPort: 24319,
				startedAt: "2026-10-16T12:00:00.000Z",
				jaegerBinary: "/nowhere/telemetry-binaries-darwin-arm64/bin/jaeger",
				otelcolBinary: "/nowhere/telemetry-binaries-darwin-arm64/bin/otelcol",
				platform: "darwin-arm64",
				logsPath: join(home, "telemetry", "logs.jsonl"),
			}),
		);
		writeFileSync(join(home, "telemetry.pid"), String(jaegerPid));

		const status = await daemonStatus();

		expect(status.running).toBe(false);
		expect(existsSync(join(home, "telemetry.json")), "telemetry.json is still there").toBe(true);
		expect(existsSync(join(home, "telemetry.pid")), "telemetry.pid is still there").toBe(true);
	});
});

describe("the daemon's state is decided from its reads", () => {
	it("a slow port reads as running and slow, and the record is never written or removed", () => {
		const reads = fakeReads({
			record: rec(101, 102),
			processes: [jaegerCmd(101, HOME), collectorCmd(102, HOME)],
		});
		const state = daemonState(reads, HOME);
		expect(state.kind).toBe("running");
		const lines = renderStatus(state, { 24318: { answer: "timeout", waitedMs: 500 } });
		expect(lines.join("\n")).toMatch(/:24318 did not answer in 500 ms \(slow, not gone\)/);
		expect(reads.removed).toEqual([]);
		expect(reads.written).toEqual([]);
	});

	it("a stale record with nothing running reads not running, is named, and stays", () => {
		const reads = fakeReads({ record: rec(101, 102), processes: [] });
		const state = daemonState(reads, HOME);
		expect(state.kind).toBe("stale");
		expect(renderStatus(state, {}).join("\n")).toMatch(/record names jaeger 101 and otelcol 102/);
		expect(reads.removed).toEqual([]);
		expect(reads.written).toEqual([]);
	});

	it("a recorded pid now running something else is not the daemon", () => {
		const reads = fakeReads({
			record: rec(101, 102),
			processes: [
				{ pid: 101, startedAt: null, command: "/usr/bin/vim notes.md" },
				collectorCmd(102, HOME),
			],
		});
		expect(daemonState(reads, HOME).kind).toBe("partial");
	});
});

describe("strays are listed", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared
	it("lists every own daemon process the record does not name", () => {
		const reads = fakeReads({
			record: rec(101, 102),
			processes: [
				jaegerCmd(101, HOME),
				collectorCmd(102, HOME),
				jaegerCmd(201, HOME, { install: GLOBAL }),
			],
			listening: { 201: [54677, 54678] },
		});
		const state = daemonState(reads, HOME);
		expect(state.strays.map((p) => p.pid)).toEqual([201]);
		const out = renderStatus(state, {}).join("\n");
		expect(out).toMatch(/jaeger 201 .* started .* ports 54677, 54678 .* from .*telemetry-binaries/);
		expect(out).toMatch(/indusk telemetry reap/);
	});

	it("another home's daemon is nobody's stray here", () => {
		const reads = fakeReads({
			record: rec(101, 102),
			processes: [jaegerCmd(101, HOME), collectorCmd(102, HOME), jaegerCmd(301, "/tmp/other-home")],
		});
		expect(daemonState(reads, HOME).strays).toEqual([]);
	});
});
