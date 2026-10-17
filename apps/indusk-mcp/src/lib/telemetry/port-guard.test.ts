// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
// promise: the-daemon-readers-follow-is-the-one-running
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	collectorCmd,
	fakeReads,
	HOME,
	jaegerCmd,
	rec,
} from "../../__tests__/helpers/daemon-reads.js";
import { PORT_BLOCK, type StoredAddress } from "./daemon-address.js";
import { ensureDaemon, refusalText, startOptions, startPlan, startReport } from "./start-plan.js";

/**
 * The startup port guard.
 *
 * A port that is taken is never silently replaced: at first setup a block port
 * held by something that is not InDusk's is replaced once and the start says
 * which port, which process and which port it picked; once an address is
 * stored, a start that finds one of its ports held starts nothing, picks
 * nothing and names the holder.
 *
 * The first group binds real sockets: the bug that made this guard was a real
 * port being really occupied, and a stub would only prove the guard reads
 * whatever the stub returns. The rest are decisions over `DaemonReads`.
 */

describe("daemonStart port guard in a temporary home", { timeout: 30000 }, () => {
	let home: string;
	let servers: Server[];
	let originalHome: string | undefined;

	function occupy(): Promise<number> {
		return new Promise((resolve, reject) => {
			const s = createServer();
			servers.push(s);
			s.once("error", reject);
			s.listen(0, "127.0.0.1", () => {
				const addr = s.address();
				if (typeof addr === "object" && addr !== null) resolve(addr.port);
				else reject(new Error("no port"));
			});
		});
	}

	beforeEach(() => {
		// A fresh INDUSK_HOME means nothing is running, which is exactly the
		// state in which the old code would silently bump the port.
		home = mkdtempSync(join(tmpdir(), "port-guard-home-"));
		originalHome = process.env.INDUSK_HOME;
		process.env.INDUSK_HOME = home;
		servers = [];
	});

	afterEach(async () => {
		for (const s of servers) await new Promise((r) => s.close(() => r(null)));
		if (originalHome === undefined) Reflect.deleteProperty(process.env, "INDUSK_HOME");
		else process.env.INDUSK_HOME = originalHome;
		rmSync(home, { recursive: true, force: true });
	});

	it("refuses to start when a requested traces port is already served", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		await expect(daemonStart({ otlpPort: taken, uiPort: 0 })).rejects.toThrow(
			/Refusing to start.*traces port \d+ is held by/s,
		);
	});

	// A3: a refusal names its holder, by process id and command, so a person
	// can act on it. The holder here is this test process, which listens.
	it("names the process holding the taken port, by process id and command", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		await expect(daemonStart({ otlpPort: taken, uiPort: 0 })).rejects.toThrow(
			new RegExp(`${taken} is held by ${process.pid} \\(.*node`),
		);
	});

	it("does not suggest reap for a holder that is not InDusk's", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		const err = await daemonStart({ otlpPort: taken, uiPort: 0 }).catch((e: Error) => e);
		expect(String(err)).not.toMatch(/telemetry reap/);
	});

	it("refuses on the interface port too, not just traces", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		await expect(daemonStart({ otlpPort: 0, uiPort: taken })).rejects.toThrow(
			/interface port \d+ is held by/,
		);
	});
});

const HOME_ADDRESS: StoredAddress = { ...PORT_BLOCK, picked: [] };
const STRANGER = { pid: 4242, command: "/opt/homebrew/bin/otelcol-contrib --config x.yaml" };
const spawnSpy = () => vi.fn(async () => rec(901, 902));

describe("A3 — first setup picks once; a stored address is never moved", () => {
	it("a block port held at first setup is replaced by a port picked once and stored; the start says so and exits zero", async () => {
		const reads = fakeReads({ record: null, address: null, holders: { 24319: STRANGER } });
		// the caller hands in the free ports it picked (the pure rule never opens a socket)
		const plan = startPlan({ kind: "none" }, { 24319: STRANGER }, HOME, {
			address: null,
			spare: [51234],
		});
		expect(plan).toEqual({
			kind: "start",
			ports: { ...PORT_BLOCK, logs: 51234 },
			store: {
				...PORT_BLOCK,
				logs: 51234,
				picked: [{ role: "logs", blockPort: 24319, holder: `4242 ${STRANGER.command}` }],
			},
		});
		const result = await ensureDaemon("start", reads, HOME, spawnSpy(), { spare: [51234] });
		const out = startReport(result);
		expect(out.code).toBe(0);
		expect(out.text).toMatch(/24319.*4242.*otelcol-contrib.*51234/s);
	});

	it("a stored port held later by a stranger: starts nothing, picks nothing, leaves the address as it was, names the holder, exits non-zero", async () => {
		const reads = fakeReads({ record: null, address: HOME_ADDRESS, holders: { 24319: STRANGER } });
		const spawn = spawnSpy();
		const result = await ensureDaemon("start", reads, HOME, spawn);
		expect(spawn).not.toHaveBeenCalled();
		expect(reads.addressWrites).toEqual([]);
		expect(reads.address()).toEqual(HOME_ADDRESS);
		const out = startReport(result);
		expect(out.code).not.toBe(0);
		expect(out.text).toMatch(
			/logs port 24319 is held by 4242 \(\/opt\/homebrew\/bin\/otelcol-contrib/,
		);
		expect(out.text).toMatch(/telemetry address --reset/);
	});

	it("suggests reap only for an InDusk holder of another home or an orphan", () => {
		const other = { pid: 8, command: jaegerCmd(8, "/home/other/.indusk").command };
		const plan = startPlan({ kind: "none" }, { 24318: other }, HOME, { address: HOME_ADDRESS });
		expect(refusalText(plan, HOME, HOME_ADDRESS)).toMatch(/indusk telemetry reap/);
		const stranger = startPlan({ kind: "none" }, { 24318: STRANGER }, HOME, {
			address: HOME_ADDRESS,
		});
		expect(refusalText(stranger, HOME, HOME_ADDRESS)).not.toMatch(/telemetry reap/);
	});

	it("in a temporary home a given port 0 means any, so a held port is not a conflict", () => {
		const plan = startPlan({ kind: "none" }, { 24318: STRANGER }, "/tmp/h-1", {
			address: HOME_ADDRESS,
			given: { traces: 0 },
		});
		expect(plan.kind).toBe("start");
	});
});

describe("A4 — once an address is stored, every start in the real home uses it", () => {
	const STORED: StoredAddress = {
		...PORT_BLOCK,
		logs: 51234,
		picked: [{ role: "logs", blockPort: 24319 }],
	};

	it.each(["start", "restart", "register"])(
		"%s with an address stored uses it and never picks again",
		async (by) => {
			const reads = fakeReads({ record: null, address: STORED });
			const spawn = spawnSpy();
			await ensureDaemon(by, reads, HOME, spawn);
			expect(spawn).toHaveBeenCalledWith({
				ports: { traces: 24318, logs: 51234, ui: 24316, mcp: 24317 },
			});
			expect(reads.addressWrites).toEqual([]);
		},
	);

	it("the record lost and rebuilt from the process list leaves the address as it was", async () => {
		const reads = fakeReads({
			record: null,
			address: STORED,
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			listening: { 1: [24318, 24316, 24317], 2: [51234] },
			yaml: {
				ports: { otlpPort: 24318, uiPort: 24316, mcpPort: 24317, logsOtlpPort: 51234 },
				mtimeAfterStart: false,
			},
		});
		const result = await ensureDaemon("status", reads, HOME, spawnSpy());
		expect(result.kind).toBe("took-over");
		expect(reads.address()).toEqual(STORED);
		expect(reads.addressWrites).toEqual([]);
	});

	it("the real home refuses explicit port options by name", () => {
		expect(() => startOptions({ otlpPort: 5000 }, HOME)).toThrow(
			/--otlp-port .* only in a temporary home/,
		);
		expect(() => startOptions({ mcpPort: 5000 }, HOME)).toThrow(
			/--mcp-port .* only in a temporary home/,
		);
	});

	it("a temporary home takes the ports it is given and never reads or writes an address", async () => {
		expect(startOptions({ otlpPort: 5000, logsPort: 5001 }, "/tmp/h-1")).toEqual({
			traces: 5000,
			logs: 5001,
		});
		const reads = fakeReads({ record: null, address: STORED });
		const spawn = spawnSpy();
		await ensureDaemon("start", reads, "/tmp/h-1", spawn, { given: { traces: 5000 } });
		expect(spawn).toHaveBeenCalledWith({ ports: { traces: 5000, logs: 0, ui: 0, mcp: 0 } });
		expect(reads.addressWrites).toEqual([]);
	});
});

describe("A42 — a refusal suggests reap only where reap can act", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	const OTHER_HOME = "/home/other/.indusk";
	const refusedBy = (command: string) =>
		startPlan({ kind: "none" }, { 24318: { pid: 8, command } }, HOME, { address: HOME_ADDRESS });

	it("a live daemon of another home is named with its home and how to stop it there, never reap", () => {
		const text = refusalText(
			refusedBy(jaegerCmd(8, OTHER_HOME).command),
			HOME,
			HOME_ADDRESS,
			() => true,
		);
		expect(text).toContain(OTHER_HOME);
		expect(text).toContain(`INDUSK_HOME=${OTHER_HOME} indusk telemetry stop`);
		expect(text).not.toMatch(/telemetry reap/);
	});

	it("an orphan, whose home is gone, is a reap", () => {
		const text = refusalText(
			refusedBy(jaegerCmd(8, OTHER_HOME).command),
			HOME,
			HOME_ADDRESS,
			() => false,
		);
		expect(text).toMatch(/indusk telemetry reap/);
	});

	it("this home's own stray is a reap", () => {
		const text = refusalText(refusedBy(jaegerCmd(8, HOME).command), HOME, HOME_ADDRESS, () => true);
		expect(text).toMatch(/indusk telemetry reap/);
		expect(text).not.toMatch(/INDUSK_HOME=/);
	});
});
