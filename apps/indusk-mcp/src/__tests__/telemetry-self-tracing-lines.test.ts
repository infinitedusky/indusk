// clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable
// promise: the-daemon-readers-follow-is-the-one-running
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderJaegerConfig } from "../lib/telemetry/daemon.js";
import { linesSince, timestampOf } from "../lib/telemetry/daemon-reads.js";
import { selfTracingLines, selfTracingSince } from "../lib/telemetry/daemon-state.js";
import { renderServerConfig } from "../lib/telemetry/server.js";
import { fakeReads, rec } from "./helpers/daemon-reads.js";

/**
 * The unit half of A23 and the counting Build Phase 5's report reads: every
 * Jaeger configuration InDusk renders or ships switches its own tracing off
 * (`jaeger_query.enable_tracing: false`), and a line of Jaeger failing to
 * trace itself is told from every other line, in both timestamp formats the
 * daemon's log holds.
 */

const REPO = resolve(__dirname, "../../../..");
const OFF = /jaeger_query:[\s\S]*?\n {4}enable_tracing: false\n/;

const GRPC_LINE =
	"2026/10/16 19:13:04 traces export: context deadline exceeded: rpc error: code = Unavailable desc = connection error: dial tcp [::1]:4317: connect: connection refused";
const ZAP_LINE =
	'2026-10-16T19:13:17.583-0400\twarn\tgrpc@v1.79.3/clientconn.go:1456\t[core] [Channel #1]grpc: addrConn.createTransport failed to connect to {Addr: "localhost:4317"}';

describe("every Jaeger configuration switches Jaeger's own tracing off", () => {
	it("the config the daemon renders", () => {
		const yaml = renderJaegerConfig({
			otlpHttp: 1,
			otlpGrpc: 2,
			ui: 3,
			uiGrpc: 4,
			health: 5,
			mcp: 6,
		});
		expect(yaml).toMatch(OFF);
	});

	it("the config a recording server renders", () => {
		const yaml = renderServerConfig(
			{
				volume: "/data",
				user: "u",
				password: "p",
				retentionHours: 1,
				queryPort: 2,
				grpcPort: 3,
				otlpPort: 4,
			} as never,
			2,
		);
		expect(yaml).toMatch(OFF);
	});

	it.each(["shared", "darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"])(
		"the shipped config of telemetry-binaries-%s",
		(name) => {
			const yaml = readFileSync(
				join(REPO, "packages", `telemetry-binaries-${name}`, "jaeger-config.yaml"),
				"utf-8",
			);
			expect(yaml).toMatch(OFF);
		},
	);
});

describe("selfTracingLines tells Jaeger failing to trace itself from every other line", () => {
	it("counts both formats and gives the first", () => {
		const lines = ["2026/10/16 19:13:00 started", GRPC_LINE, "other", ZAP_LINE];
		expect(selfTracingLines(lines)).toEqual({ count: 2, first: GRPC_LINE });
	});

	it("a line naming :4317 that is neither export nor transport failure is not counted", () => {
		expect(selfTracingLines(["listening on :4317 for otlp"])).toEqual({ count: 0 });
	});

	it("an empty log has none", () => {
		expect(selfTracingLines([])).toEqual({ count: 0 });
	});
});

describe("linesSince scans back to the first line before a time, in either timestamp format", () => {
	const startedAt = Date.parse("2026-10-16T19:13:10.000-04:00");

	it("keeps the lines written after the start and drops those before", () => {
		const lines = [
			`${new Date(startedAt - 60_000).toISOString()} before`,
			"2026-10-16T19:13:17.583-0400\twarn\tafter",
			"an unstamped continuation line",
		];
		expect(linesSince(lines, startedAt)).toEqual(lines.slice(1));
	});

	it("reads Jaeger's slash-dated lines and zap's offset lines as times", () => {
		expect(timestampOf("2026/10/16 19:13:04 traces export: x")).toBe(
			new Date(2026, 9, 16, 19, 13, 4).getTime(),
		);
		expect(timestampOf("2026-10-16T19:13:17.583-0400\twarn")).toBe(
			Date.parse("2026-10-16T19:13:17.583-04:00"),
		);
		expect(timestampOf("no stamp here")).toBeNull();
	});
});

describe("selfTracingSince counts from the byte offset the record holds", () => {
	it("asks the log from the recorded offset and counts what is there", () => {
		const asked: unknown[] = [];
		const reads = fakeReads({ log: [GRPC_LINE, "fine", ZAP_LINE] });
		const spy = {
			...reads,
			logSince: (from: unknown) => {
				asked.push(from);
				return reads.logSince(from as never);
			},
		};
		expect(selfTracingSince(spy, rec(1, 2, { logOffset: 120 }))).toEqual({
			count: 2,
			first: GRPC_LINE,
		});
		expect(asked).toEqual([{ offset: 120 }]);
	});

	it("falls back to the daemon's start time when the record holds no offset", () => {
		const asked: unknown[] = [];
		const reads = fakeReads({ log: [] });
		const spy = {
			...reads,
			logSince: (from: unknown) => {
				asked.push(from);
				return [];
			},
		};
		selfTracingSince(spy, rec(1, 2, { startedAt: "2026-10-16T12:00:00.000Z" }));
		expect(asked).toEqual([{ time: Date.parse("2026-10-16T12:00:00.000Z") }]);
	});
});
