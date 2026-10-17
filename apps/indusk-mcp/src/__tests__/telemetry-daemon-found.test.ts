// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
// promise: the-daemon-readers-follow-is-the-one-running
import { describe, expect, it } from "vitest";
import { describeFinding, findDaemon } from "../lib/telemetry/daemon-find.js";
import { listeningFromProc } from "../lib/telemetry/daemon-reads.js";
import { BLOCK, collectorCmd, fakeReads, HOME, jaegerCmd, rec } from "./helpers/daemon-reads.js";

/**
 * A10 — with the record missing while an InDusk daemon runs, the finder reads
 * the daemon's ports from its listening sockets and writes the record again,
 * once, with an exclusive create.
 *
 * A pure unit test over `DaemonReads`: no socket is opened, no process
 * started, and the machine described is this one on 2026-10-16, a daemon
 * started before this change on Jaeger's own default ports.
 */

// /proc/net/tcp as a Linux kernel prints it: 4318 is 0x10DE, 16686 is 0x412E, 62845 is 0xF57D.
// The third row listens too, but no process of interest holds it; the last row is an
// ESTABLISHED connection (state 01), not a listener.
const PROC_NET_TCP_FIXTURE = [
	"  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode",
	"   0: 00000000:10DE 00000000:0000 0A 00000000:00000000 00:00000000 00000000   501        0 70001 1 0 100 0 0",
	"   1: 00000000:412E 00000000:0000 0A 00000000:00000000 00:00000000 00000000   501        0 70002 1 0 100 0 0",
	"   2: 00000000:F57D 00000000:0000 0A 00000000:00000000 00:00000000 00000000   501        0 70003 1 0 100 0 0",
	"   3: 0100007F:10DE 0100007F:C350 01 00000000:00000000 00:00000000 00000000   501        0 70004 1 0 100 0 0",
].join("\n");
// Process 43599 holds the two listening sockets, the connection and two non-sockets; 43600 holds none.
const FD_FIXTURE: Record<number, string[]> = {
	43599: [
		"socket:[70001]",
		"socket:[70002]",
		"socket:[70004]",
		"anon_inode:[eventpoll]",
		"/dev/null",
	],
	43600: ["/dev/null"],
};

describe("A10 — a lost daemon is found", () => {
	it("finds a running daemon from ps and its sockets and writes the record again", async () => {
		// this machine's daemon on 2026-10-16, started before this change: 4318 and 16686 are labelled as Jaeger's own defaults
		const reads = fakeReads({
			record: null,
			processes: [jaegerCmd(43599, HOME), collectorCmd(43600, HOME)],
			listening: { 43599: [4318, 16686, 62843], 43600: [62841] },
			yaml: { mtimeAfterStart: true },
		});
		const found = await findDaemon(reads, HOME, "status");
		expect(found?.meta).toMatchObject({
			jaegerPid: 43599,
			otelcolPid: 43600,
			otlpPort: 4318,
			uiPort: 16686,
		});
		expect(found?.unknownRoles).toEqual(["mcp", "logs"]); // a stale yaml is not trusted; ports are never guessed
		expect(reads.written).toEqual([{ meta: found?.meta, exclusive: true }]);
	});

	it("reads listening sockets from /proc when lsof is missing", () => {
		expect(listeningFromProc(PROC_NET_TCP_FIXTURE, FD_FIXTURE)).toEqual({ 43599: [4318, 16686] });
	});

	it("labels every role from a rendered yaml the daemon started after", async () => {
		const reads = fakeReads({
			record: null,
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			listening: { 1: [24318, 24316, 24317], 2: [24319] },
			yaml: { ports: BLOCK, mtimeAfterStart: false },
		});
		const found = await findDaemon(reads, HOME, "status");
		expect(found?.meta).toMatchObject({
			otlpPort: 24318,
			uiPort: 24316,
			mcpPort: 24317,
			logsOtlpPort: 24319,
		});
		expect(found?.unknownRoles).toEqual([]);
	});

	it("does not trust a yaml that names a port the daemon does not hold", async () => {
		const reads = fakeReads({
			record: null,
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			listening: { 1: [4318, 16686], 2: [50000] },
			yaml: { ports: BLOCK, mtimeAfterStart: false },
		});
		const found = await findDaemon(reads, HOME, "status");
		expect(found?.meta).toMatchObject({ otlpPort: 4318, uiPort: 16686 });
		expect(found?.unknownRoles).toEqual(["mcp", "logs"]);
	});

	it("is only the finder when its create wins: a record another command wrote first is read back", async () => {
		const other = rec(1, 2);
		const reads = fakeReads({
			record: null,
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			listening: { 1: [4318, 16686], 2: [] },
		});
		reads.writeRecord(other, { exclusive: true }); // the other command's write lands first
		reads.written.length = 0;
		const found = await findDaemon(reads, HOME, "promises");
		expect(found?.finder).toBe(false);
		expect(found?.meta).toEqual(other);
		expect(reads.written).toEqual([]);
	});

	it("with several daemons takes the one holding the traces port and lists the rest as strays", async () => {
		const reads = fakeReads({
			record: null,
			processes: [
				jaegerCmd(1, HOME, { startedAt: "2026-10-16T10:00:00.000Z" }),
				collectorCmd(2, HOME, { startedAt: "2026-10-16T10:00:05.000Z" }),
				jaegerCmd(3, HOME, { startedAt: "2026-10-16T11:00:00.000Z" }),
				collectorCmd(4, HOME, { startedAt: "2026-10-16T11:00:05.000Z" }),
			],
			listening: { 1: [50001, 50002], 2: [50003], 3: [4318, 16686], 4: [50004] },
		});
		const found = await findDaemon(reads, HOME, "status");
		expect(found?.meta).toMatchObject({ jaegerPid: 3, otelcolPid: 4, otlpPort: 4318 });
		expect(found?.strays.map((p) => p.pid).sort()).toEqual([1, 2]);
	});

	it("takes none when no daemon holds the traces port", async () => {
		const reads = fakeReads({
			record: null,
			processes: [
				jaegerCmd(1, HOME, { startedAt: "2026-10-16T10:00:00.000Z" }),
				collectorCmd(2, HOME, { startedAt: "2026-10-16T10:00:05.000Z" }),
				jaegerCmd(3, HOME, { startedAt: "2026-10-16T11:00:00.000Z" }),
				collectorCmd(4, HOME, { startedAt: "2026-10-16T11:00:05.000Z" }),
			],
			listening: { 1: [50001], 2: [50003], 3: [50002], 4: [50004] },
		});
		expect(await findDaemon(reads, HOME, "status")).toBeNull();
		expect(reads.written).toEqual([]);
	});

	it("says what status prints about a finding, and nothing for a command whose create lost", async () => {
		const mine = fakeReads({
			record: null,
			processes: [jaegerCmd(43599, HOME), collectorCmd(43600, HOME)],
			listening: { 43599: [4318, 16686], 43600: [] },
		});
		const found = await findDaemon(mine, HOME, "status");
		expect(found && describeFinding(found)).toContain("written again; ports not read: mcp, logs");
		expect(found && describeFinding({ ...found, finder: false })).toBeNull();
	});
});
