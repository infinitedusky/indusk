// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
// promise: the-daemon-readers-follow-is-the-one-running
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PickedPort } from "../lib/telemetry/daemon-address.js";
import { PORT_BLOCK, type Ports } from "../lib/telemetry/daemon-address.js";
import {
	daemonReports,
	type ReportState,
	readerReports,
	reportReaderRead,
} from "../lib/telemetry/daemon-reports.js";
import { daemonState, findDaemon } from "../lib/telemetry/daemon-state.js";
import { collectorCmd, fakeReads, HOME, jaegerCmd, rec } from "./helpers/daemon-reads.js";

/**
 * A6, A9, A14, A18 and A24 — what each command reports about the daemon,
 * decided by `daemonReports` from reads handed to it. Nothing is sent: a report
 * here is a description, and only the live check proves one reaches a reader.
 */

const LINE =
	'{"level":"info","ts":"2026-10-16T19:13:17.583-0400","msg":"traces export: failed to connect to 127.0.0.1:4317"}';

/** A running daemon holding `held` (and the address stored for it: the block, or the held ports when some were picked). */
function running(held: Ports & { picked?: PickedPort[] }): ReportState {
	const processes = [jaegerCmd(1, HOME), collectorCmd(2, HOME)];
	const files = Object.fromEntries(
		processes.map((p) => [
			/--config=(?:file:)?(\S+)/.exec(p.command)?.[1] ?? "",
			{ mtimeMs: 1, size: 1 },
		]),
	);
	const picked = held.picked ?? [];
	const stored = picked.length > 0 ? { ...held, picked } : { ...PORT_BLOCK, picked };
	return daemonState(
		fakeReads({
			record: rec(1, 2, {
				otlpPort: held.traces,
				logsOtlpPort: held.logs,
				uiPort: held.ui,
				mcpPort: held.mcp,
			}),
			processes,
			files,
			address: stored,
		}),
		HOME,
	);
}

/** The same daemon with a second daemon's processes beside it, the first pid a Jaeger, the second a collector. */
function withStray(state: ReportState, ...pids: number[]): ReportState {
	return {
		...state,
		strays: [
			...state.strays,
			...pids.map((pid, i) => ({
				pid,
				role: i % 2 === 0 ? ("jaeger" as const) : ("otelcol" as const),
				binary: "/x/bin/jaeger",
				startedAt: "2026-10-16T12:30:00.000Z",
				ports: [],
			})),
		],
	};
}

const FOUND = { by: "status", jaegerPid: 43599, startedAt: "2026-10-16T12:00:00.000Z" };
const FOUND_BY_STATUS: ReportState = { ...running(PORT_BLOCK), finding: FOUND };

describe("A6 — status reports whether one daemon holds its own ports", () => {
	it("status: upheld on the stored address, broken naming the extra process and the ports not held", () => {
		expect(daemonReports("status", running(PORT_BLOCK))).toContainEqual(
			expect.objectContaining({ clause: "one-daemon-on-its-own-ports", outcome: "upheld" }),
		);
		const broken = daemonReports("status", withStray(running({ ...PORT_BLOCK, mcp: 62843 }), 201));
		const r = broken.find((x) => x.clause === "one-daemon-on-its-own-ports");
		expect(r?.outcome).toBe("broken");
		expect(r?.symptom).toMatch(
			/^one-daemon-on-its-own-ports: .*jaeger 201.*MCP on 62843, expected 24317/,
		);
	});

	it("status: ports picked at first setup are upheld, with the held block port as an attribute", () => {
		const picked = {
			...PORT_BLOCK,
			logs: 51234,
			picked: [{ role: "logs" as const, blockPort: 24319, holder: "otelcol-contrib 812" }],
		};
		const r = daemonReports("status", running(picked)).find(
			(x) => x.clause === "one-daemon-on-its-own-ports",
		);
		expect(r).toMatchObject({
			outcome: "upheld",
			attributes: expect.objectContaining({ "indusk.daemon.picked": "logs:24319" }),
		});
	});
});

/** A daemon whose record names both processes while only `alive` still run. */
function halfRunning(alive: "jaeger" | "otelcol"): ReportState {
	const processes = alive === "jaeger" ? [jaegerCmd(1, HOME)] : [collectorCmd(2, HOME)];
	const files = Object.fromEntries(
		processes.map((p) => [
			/--config=(?:file:)?(\S+)/.exec(p.command)?.[1] ?? "",
			{ mtimeMs: 1, size: 1 },
		]),
	);
	return daemonState(
		fakeReads({
			record: rec(1, 2),
			processes,
			files,
			address: { ...PORT_BLOCK, picked: [] },
		}),
		HOME,
	);
}

describe("A32 — status reports a half-running daemon", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	it("a Jaeger that runs beside a collector that has died is reported broken, naming the collector and the logs port it no longer holds", () => {
		const state = halfRunning("jaeger");
		expect(state.kind).toBe("partial");
		const r = daemonReports("status", state).find(
			(x) => x.clause === "one-daemon-on-its-own-ports",
		);
		expect(r?.outcome).toBe("broken");
		expect(r?.symptom).toMatch(/otelcol.*not running/);
		expect(r?.symptom).toMatch(/logs.*24319/);
	});

	// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
	it("a Jaeger that has died cannot receive a report, so nothing is decided to send", () => {
		expect(daemonReports("status", halfRunning("otelcol"))).toEqual([]);
	});
});

describe("A9 — a reader's read through the record reports once a quarter hour", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
	it("a read through the record sends one upheld report per project per 15 minutes", () => {
		const t0 = Date.parse("2026-10-16T20:00:00Z");
		expect(
			readerReports({ via: "record", project: "dusk", now: t0, lastStamp: null }),
		).toHaveLength(1);
		expect(
			readerReports({ via: "record", project: "dusk", now: t0 + 60_000, lastStamp: t0 }),
		).toHaveLength(0);
		expect(
			readerReports({ via: "record", project: "dusk", now: t0 + 15 * 60_000, lastStamp: t0 }),
		).toHaveLength(1);
	});

	it("a read that had to find the daemon sends the finding's broken report, not upheld", () => {
		const r = readerReports({
			via: "found",
			project: "dusk",
			now: 0,
			lastStamp: null,
			found: FOUND,
		});
		expect(r.map((x) => [x.clause, x.outcome])).toContainEqual([
			"a-read-never-loses-the-daemon",
			"broken",
		]);
		expect(
			r.some((x) => x.clause === "a-read-never-loses-the-daemon" && x.outcome === "upheld"),
		).toBe(false);
	});
});

describe("A14 — a finding and a start report what they found", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
	it("a finding: upheld for a-lost-daemon-is-found, broken for a-read-never-loses-the-daemon", () => {
		const r = daemonReports("found", FOUND_BY_STATUS);
		expect(r).toContainEqual(
			expect.objectContaining({ clause: "a-lost-daemon-is-found", outcome: "upheld" }),
		);
		expect(r.find((x) => x.clause === "a-read-never-loses-the-daemon")?.symptom).toMatch(
			/^a-read-never-loses-the-daemon: the record was missing while jaeger 43599 \(started .*\) ran; found by status/,
		);
	});

	it("a start with another daemon beside it: broken naming the one it missed", () => {
		const r = daemonReports("started", withStray(running(PORT_BLOCK), 201));
		expect(r.find((x) => x.clause === "a-lost-daemon-is-found")).toMatchObject({
			outcome: "broken",
		});
	});
});

describe("A18 — register reports whether it started a second daemon or moved another entry", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second
	it("register: upheld when it found the one daemon and changed no other entry", () => {
		expect(
			daemonReports("register", {
				...running(PORT_BLOCK),
				registered: { project: "/p", daemon: "found", otherEntriesChanged: [] },
			}),
		).toContainEqual(
			expect.objectContaining({ clause: "nothing-starts-a-second", outcome: "upheld" }),
		);
	});

	it("register: broken naming a second daemon by both process ids, or each other entry changed", () => {
		const r = daemonReports("register", {
			...withStray(running(PORT_BLOCK), 201, 202),
			registered: {
				project: "/p",
				daemon: "started",
				otherEntriesChanged: [{ path: "/q", from: ":62843", to: ":24317" }],
			},
		});
		expect(r.find((x) => x.clause === "nothing-starts-a-second")?.symptom).toMatch(
			/201.*202.*\/q.*62843.*24317/s,
		);
	});
});

describe("A24 — status reports whether the log is readable", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable
	it("status: upheld with no self-tracing line since start, broken with the count and the first", () => {
		expect(
			daemonReports("status", { ...running(PORT_BLOCK), selfTracing: { count: 0 } }),
		).toContainEqual(expect.objectContaining({ clause: "the-log-is-readable", outcome: "upheld" }));
		const r = daemonReports("status", {
			...running(PORT_BLOCK),
			selfTracing: { count: 17, first: LINE },
		});
		expect(r.find((x) => x.clause === "the-log-is-readable")?.symptom).toMatch(
			/^the-log-is-readable: 17 lines .*4317/,
		);
	});
});

describe("a finder tells the daemon it found, and only the finder", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
	/** A machine whose daemon runs with no record, and what it was told. */
	function lostDaemon(record: ReturnType<typeof rec> | null = null) {
		const told: { port: number; clauses: string[] }[] = [];
		const reads = {
			...fakeReads({
				record,
				processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
				listening: { 1: [24318, 24316, 24317], 2: [24319] },
				yaml: {
					ports: { otlpPort: 24318, uiPort: 24316, mcpPort: 24317, logsOtlpPort: 24319 },
					mtimeAfterStart: false,
				},
			}),
			async report(port: number, reports: { clause: string }[]) {
				told.push({ port, clauses: reports.map((r) => r.clause) });
			},
		};
		return { reads, told };
	}

	it("the command whose create wrote the record sends both findings to the found daemon", async () => {
		const { reads, told } = lostDaemon();
		const found = await findDaemon(reads, HOME, "status");
		expect(found?.finder).toBe(true);
		expect(told).toEqual([
			{ port: 24318, clauses: ["a-lost-daemon-is-found", "a-read-never-loses-the-daemon"] },
		]);
	});

	it("a command whose create lost to another's sends nothing", async () => {
		const { reads, told } = lostDaemon();
		reads.writeRecord(rec(1, 2), { exclusive: true });
		const found = await findDaemon({ ...reads, record: () => null }, HOME, "update");
		expect(found?.finder).toBe(false);
		expect(told).toEqual([]);
	});
});

describe("A9 — the reader's stamp throttles the report on disk", () => {
	// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
	it("two reads of one project a minute apart send once; another project sends its own", async () => {
		const home = mkdtempSync(join(tmpdir(), "reader-stamp-"));
		try {
			const sent: { project?: string }[] = [];
			const reads = {
				...fakeReads(),
				async report(_port: number, reports: { project?: string }[]) {
					sent.push(...reports);
				},
			};
			const t0 = Date.parse("2026-10-16T20:00:00Z");
			const read = (project: string, now: number) =>
				reportReaderRead({ reads, home, project, otlpPort: 24318, now });
			await read("dusk", t0);
			await read("dusk", t0 + 60_000);
			await read("seats", t0 + 60_000);
			await read("dusk", t0 + 15 * 60_000);
			expect(sent.map((r) => r.project)).toEqual(["dusk", "seats", "dusk"]);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});
});
