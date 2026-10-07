import { describe, expect, it } from "vitest";
import type { DaemonMeta } from "./status.js";
import { type StopDeps, stopDaemon } from "./stop.js";

/**
 * promise: telemetry-stop-stops-what-it-started — telemetry-stop A1–A3.
 *
 * The 1.65.0 release left nine Jaeger and otelcol processes running, each
 * home's record deleted: stop judged its own processes by whether their port
 * answered, under load the port did not, so it signalled nothing and reported
 * them stopped. Here the port never answers, and ownership is the command line.
 */

const HOME = "/tmp/indusk-home-x";
const meta = {
	jaegerPid: 101,
	otelcolPid: 102,
	uiPort: 16686,
	otelcolHealthPort: 13133,
	jaegerBinary: "/bin/jaeger",
	otelcolBinary: "/bin/otelcol",
} as DaemonMeta;
const OWN: Record<number, string> = {
	101: `/bin/jaeger --config=file:${HOME}/telemetry-jaeger.yaml`,
	102: `/bin/otelcol --config=${HOME}/telemetry-collector.yaml`,
};

/** A process table: who runs what, and whether a signal ends them. */
function table(commands: Record<number, string>, { dies = true } = {}) {
	const live = new Set(Object.keys(commands).map(Number));
	const signals: Array<[number, string]> = [];
	const deps: StopDeps = {
		alive: (pid) => live.has(pid),
		command: (pid) => (live.has(pid) ? (commands[pid] ?? null) : null),
		kill: (pid, signal) => {
			signals.push([pid, signal]);
			if (dies) live.delete(pid);
		},
		sleep: async () => {},
		portAnswers: async () => false,
	};
	return { deps, signals };
}

describe("telemetry stop judges its own processes by their command line", () => {
	it("A1: its own processes are stopped though their ports never answer", async () => {
		const { deps, signals } = table(OWN);
		const r = await stopDaemon(meta, HOME, deps);
		expect(signals.map(([pid]) => pid).sort()).toEqual([101, 102]);
		expect(r).toMatchObject({ stopped: true, clearRecord: true, stillRunning: [] });
	});

	it("A2: a recorded PID now running another program is left alone, and the record cleared", async () => {
		const { deps, signals } = table({ 101: "/usr/bin/vim notes.txt" });
		const r = await stopDaemon(meta, HOME, deps);
		expect(signals).toEqual([]);
		expect(r).toMatchObject({ strangers: [101], clearRecord: true });
	});

	it("A2: the same binary from another home is not this daemon's", async () => {
		const { deps, signals } = table({
			101: "/bin/jaeger --config=file:/tmp/other-home/telemetry-jaeger.yaml",
		});
		await stopDaemon(meta, HOME, deps);
		expect(signals).toEqual([]);
	});

	it("A3: a process of its own that will not stop is reported, and the record kept", async () => {
		const { deps } = table(OWN, { dies: false });
		const r = await stopDaemon(meta, HOME, deps);
		expect(r.stopped).toBe(false);
		expect(r.clearRecord).toBe(false);
		expect(r.stillRunning.sort()).toEqual([101, 102]);
	});
});
