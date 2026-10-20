import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	BLOCK,
	collectorCmd,
	fakeReads,
	HOME,
	jaegerCmd,
	ON_BLOCK,
	rec,
} from "../../__tests__/helpers/daemon-reads.js";
import { keptRead, resetKept } from "../run-record/kept-reads.js";
import { countStarts, type Exec } from "../start-program.js";
import { listeningAsync, parseListening } from "./daemon-reads.js";
import { liveOtlpEndpointAsync } from "./endpoint-async.js";

/**
 * admin-pages-load-fast, Build Phase 2 (decision 9, the port check): the daemon is found for a
 * page's report without a program that stops the server. Time and the machine are inputs: a
 * described machine, a program runner that answers from a fixed `lsof` output, no program starts.
 *
 * clause: admin-pages-load-fast/never-freezes
 */

beforeEach(() => resetKept());
afterEach(() => resetKept());

/** `lsof -Fpn`: process 1 listens on three ports, process 2 on one, process 9 on none. */
const LSOF = "p1\nn*:24318\nn*:24316\nn*:24317\np2\nn*:24319\n";
const lsof =
	(calls: string[][]): Exec =>
	async (_file, args) => {
		calls.push(args);
		return LSOF;
	};

describe("the port reader gives the same port state asynchronously", () => {
	it("listeningAsync of a fixed lsof output equals the synchronous reader's rule over it, pid by pid", async () => {
		const pids = [1, 2, 9];
		const synchronous = parseListening(LSOF);
		const expected = Object.fromEntries(pids.map((pid) => [pid, synchronous[pid] ?? []]));
		expect(await listeningAsync(pids, { exec: lsof([]) })).toEqual(expected);
		expect(expected).toEqual({ 1: [24316, 24317, 24318], 2: [24319], 9: [] });
	});

	it("a machine with no pid to ask about starts nothing", async () => {
		const calls: string[][] = [];
		expect(await listeningAsync([], { exec: lsof(calls) })).toEqual({});
		expect(calls).toEqual([]);
	});
});

describe("the daemon is found for a report without stopping the server", () => {
	it("a recorded daemon whose process is alive is found with no program started", async () => {
		const reads = fakeReads({ record: rec(process.pid, 4242) });
		const { result, starts } = await countStarts(() =>
			liveOtlpEndpointAsync({ reads, home: HOME }),
		);
		expect(result).toBe("http://localhost:24318");
		expect(starts).toBe(0);
	});

	it("with no record and no process list kept on the page, no program is started and the report finds none", async () => {
		const reads = fakeReads({
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			listening: ON_BLOCK,
		});
		const { result, starts } = await countStarts(() =>
			liveOtlpEndpointAsync({ reads, home: HOME }),
		);
		expect(result).toBeNull();
		expect(starts).toBe(0);
	});

	it("with no record, a daemon in the kept process list is found from its sockets, read once however many reports ask", async () => {
		const reads = fakeReads({
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			yaml: { ports: BLOCK, mtimeAfterStart: false },
		});
		await keptRead("ps", async () => reads.processes());
		const calls: string[][] = [];
		const { result } = await countStarts(async () => {
			const first = await liveOtlpEndpointAsync({ reads, home: HOME, exec: lsof(calls) });
			const second = await liveOtlpEndpointAsync({ reads, home: HOME, exec: lsof(calls) });
			return [first, second];
		});
		expect(result).toEqual(["http://localhost:24318", "http://localhost:24318"]);
		expect(calls.length, "one lsof for both reports").toBe(1);
	});
});
