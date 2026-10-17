import { rmSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { watcherTransition } from "../lib/always-on/heartbeat.js";
import { slackText } from "../lib/always-on/pass.js";
import { startPass } from "../lib/always-on/schedule.js";
import { checkPromises, formatSummary } from "../lib/promises/check.js";
import type { IncidentEntry, PromiseEntry } from "../lib/promises/registry.js";
import { formatStatus } from "../lib/promises/status.js";
import type { MarkedSpan, MarkedSpansResult } from "../lib/promises/telemetry.js";
import { type WatchResult, watchReport } from "../lib/promises/watch.js";
import {
	behaviourPromise,
	codeFilesFor,
	openIncidentSpec,
	type PromiseSpec,
	promiseProject,
} from "./helpers/promises-fixture.js";

// promise: a-promise-is-upheld-or-broken

/**
 * A7 (the CLI's half) and A8 of one-promise-language: what the command line
 * and the always-on server print about a promise says broken, held or no
 * signal — never violated or violation — and a promise nothing has reported
 * on reads no signal. The words are read off the text each formatter returns;
 * every read behind them is handed in.
 */

const OLD = /violat/i;

const entry = (over: Partial<PromiseEntry> = {}): PromiseEntry => ({
	name: "seats-held",
	kind: "behaviour",
	lifetime: "holds",
	state: "enforced",
	domain: "seating",
	owner: "seat-holds",
	statement: "A seat is never held by two players at once.",
	sites: [],
	tests: [],
	incidents: [],
	aliases: [],
	file: "seats-held.md",
	...over,
});

const span = (outcome: string, iso: string, symptom: string | null = null): MarkedSpan =>
	({
		promise: "seats-held",
		outcome,
		traceId: `t-${iso}`,
		spanId: `s-${iso}`,
		service: "seat-holds",
		operation: "release",
		at: new Date(iso),
		symptom,
		environment: "production",
	}) as MarkedSpan;

const marks = (violations: MarkedSpan[], lastUpheld: MarkedSpan | null): MarkedSpansResult => ({
	queryUrl: "http://localhost:16686",
	since: new Date("2026-10-01T00:00:00Z"),
	byPromise: new Map([["seats-held", { violations, truncated: false, lastUpheld }]]),
});

describe("A8 — the status text says broken and held", () => {
	it("a promise with breaks says it broke, in no word of violation", () => {
		const text = formatStatus(
			[entry()],
			marks(
				[span("broken", "2026-10-09T10:00:00Z", "seat 4 held twice")],
				span("upheld", "2026-10-09T11:00:00Z"),
			),
			7,
		);
		expect(text).not.toMatch(OLD);
		expect(text).toMatch(/broke|broken|break/i);
	});

	it("a promise that held with no breaks says so in no word of violation", () => {
		const text = formatStatus([entry()], marks([], span("upheld", "2026-10-09T11:00:00Z")), 7);
		expect(text).not.toMatch(OLD);
	});
});

describe("the status text says broken by the rule the admin and the editor use", () => {
	const breaks = marks(
		[span("broken", "2026-10-09T10:00:00Z", "seat 4 held twice")],
		span("upheld", "2026-10-09T11:00:00Z"),
	);
	const incident = (status: "open" | "fixed") =>
		({
			id: "i-1",
			promise: "seats-held",
			status,
			opened: "2026-10-09T10:05:00Z",
			fixed: status === "fixed" ? "2026-10-10T00:00:00Z" : null,
			traces: ["t-2026-10-09T10:00:00Z"],
			file: "incidents/i-1.md",
		}) as unknown as IncidentEntry;

	it("a live break, unrecorded or under an open incident, reads broken", () => {
		expect(formatStatus([entry()], breaks, 7)).toMatch(/broken — 1 break in the last 7 days/);
		expect(formatStatus([entry()], breaks, 7, [incident("open")])).toMatch(/broken — 1 break/);
	});

	it("breaks whose incidents are all fixed read broke — fixed, not broken", () => {
		const text = formatStatus([entry()], breaks, 7, [incident("fixed")]);
		expect(text).toMatch(/broke — fixed — 1 break in the last 7 days/);
		expect(text).not.toMatch(/broken —/);
	});
});

describe("A7 — the status text for a promise nothing has reported on", () => {
	it("reads no signal, not not seen and not no run", () => {
		const text = formatStatus([entry()], marks([], null), 7);
		expect(text).toContain("no signal");
		expect(text).not.toMatch(/not seen in|no run exercised/i);
	});
});

describe("A8 — the watch summary", () => {
	const quiet: WatchResult = { changes: [], source: "http://localhost:16686" };

	it("with nothing new says no new breaks, in no word of violation", () => {
		const { out, err } = watchReport(quiet);
		expect([...out, ...err].join("\n")).not.toMatch(OLD);
	});

	it("with an opened incident says so in no word of violation", () => {
		const { out, err } = watchReport({
			source: "http://localhost:16686",
			changes: [
				{
					id: "i-2026-10-10-seats-held",
					kind: "opened",
					traces: ["a".repeat(32)],
					promise: "seats-held",
					owner: "seat-holds",
					reopen: { reopened: true, phase: 2 },
				},
			],
		} as unknown as WatchResult);
		expect([...out, ...err].join("\n")).not.toMatch(OLD);
	});
});

describe("A8 — the check summary and its two state refusals", () => {
	const cleanups: string[] = [];
	afterEach(() => {
		for (const c of cleanups.splice(0)) rmSync(c, { recursive: true, force: true });
	});

	function project(state: string, incident: "open" | null) {
		const fx = promiseProject({
			activePlans: ["seat-holds"],
			promises: [
				behaviourPromise("seats-held", {
					owner: "seat-holds",
					domain: "seating",
					state: state as PromiseSpec["state"],
					...(incident ? { incidents: ["i-1"] } : {}),
				}),
			],
			incidents: incident ? [openIncidentSpec("i-1", "seats-held")] : [],
			domains: ["seating"],
			files: codeFilesFor("seats-held"),
		});
		cleanups.push(fx.root);
		return fx;
	}

	it("the summary line names no violated state", async () => {
		const result = await checkPromises(project("enforced", null).planRoot);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(formatSummary(result.summary)).not.toMatch(OLD);
	});

	it("the refusal for an enforced promise with an open incident names no violation", async () => {
		const result = await checkPromises(project("enforced", "open").planRoot);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.refusals.map((r) => r.message).join("\n")).not.toMatch(OLD);
	});

	it("the refusal for a known-broken promise with no open incident names no violation", async () => {
		const result = await checkPromises(project("known-violated", null).planRoot);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.refusals.map((r) => r.message).join("\n")).not.toMatch(OLD);
	});
});

describe("A8 — the always-on server's messages", () => {
	it("the announcement to Slack says broken, in no word of violation", () => {
		const text = slackText(span("broken", "2026-10-09T10:00:00Z", "seat 4 held twice"), null);
		expect(text).not.toMatch(OLD);
	});

	it("the heartbeat's blind and recovered messages name no violation", () => {
		const now = new Date("2026-10-10T12:00:00Z");
		const blind = watcherTransition(
			null,
			{ state: "blind", reason: "no heartbeat", heardAt: now },
			now,
			"http://jaeger.test",
		);
		const recovered = watcherTransition(
			{ state: "blind", since: "2026-10-10T11:00:00Z" },
			{ state: "listening", reason: null, heardAt: now },
			now,
			"http://jaeger.test",
		);
		expect(blind.message).not.toBeNull();
		expect(recovered.message).not.toBeNull();
		expect(`${blind.message}\n${recovered.message}`).not.toMatch(OLD);
	});

	it("the schedule's note that announcements are off names no violation", () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const timer = startPass({
			volume: "/nonexistent",
			otlpPort: 4318,
			queryPort: 16686,
			grpcPort: 16685,
			user: "u",
			password: "p",
			retentionHours: 1,
			slackWebhook: null,
			passIntervalMs: 3_600_000,
			passWindowMs: 3_600_000,
			publicQueryUrl: null,
		});
		clearInterval(timer);
		const said = info.mock.calls.map((c) => String(c[0])).join("\n");
		info.mockRestore();
		expect(said).toContain("announcements are off");
		expect(said).not.toMatch(OLD);
	});
});
