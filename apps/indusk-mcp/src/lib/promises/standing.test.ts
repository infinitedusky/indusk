import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeJaegerFetch, type HeldSpan } from "../../__tests__/helpers/fake-jaeger.js";
import {
	behaviourPromise,
	codeFilesFor,
	promiseProject,
} from "../../__tests__/helpers/promises-fixture.js";
import { healthLine, healthRows, ruleFor, type SourceHealthRead } from "./health.js";
import type { HeardRow } from "./heard.js";
import { type PromiseEntry, readPromises } from "./registry.js";
import type { PlanRow } from "./rows.js";
import { readStanding, type SourcedHealth, standingOf } from "./standing.js";
import {
	jaegerEndpoint,
	type MarkedSpan,
	type MarkedSpansResult,
	markedSpans,
	marksBetween,
} from "./telemetry.js";
import type { TimelineRead } from "./timeline.js";

// promise: every-promise-is-listed
// promise: the-editor-shows-the-same-health-as-the-admin

/**
 * plan-cockpit A21 and A33, the package's halves. A21: a promise's standing is
 * the one word the dashboard groups by — a declared promise whose tests are
 * written but not all passing is *being proven*, and broken is red from the
 * alarm source. A33: the standing's health per source is the package's one
 * health rule, promise by promise, so the dashboard, a promise's page and
 * `indusk promises health --json` cannot say two things.
 */

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

const row = (id: string, state: string): PlanRow => ({
	id,
	state,
	tests: [`src/${id}.test.ts`],
	plan: "seat-holds",
	archived: false,
});

const seen = (
	source: SourcedHealth["source"],
	health: SourcedHealth["health"],
	lastSeen: string | null = null,
): SourcedHealth => ({
	source,
	health,
	violations: health === "red" ? 1 : 0,
	lastSeen,
});

describe("A21 — a promise's standing", () => {
	it("a declared promise with a passing and a written row is being proven, with its tests counted", () => {
		const r = standingOf(
			entry({ state: "declared" }),
			[],
			[row("A1", "passing"), row("A2", "written")],
		);
		expect(r.standing).toBe("being-proven");
		expect(r.tests).toEqual({ passing: 1, total: 2 });
	});

	it("a declared promise no row names is declared", () => {
		expect(standingOf(entry({ state: "declared" }), [], []).standing).toBe("declared");
	});

	it("an enforced promise with every row passing and no red is enforced", () => {
		const r = standingOf(entry(), [seen("local", "green")], [row("A1", "passing")]);
		expect(r.standing).toBe("enforced");
	});

	it("red from the alarm source is broken — production, when the project has one", () => {
		const r = standingOf(
			entry(),
			[seen("local", "green"), seen("production", "red")],
			[row("A1", "passing")],
		);
		expect(r.standing).toBe("broken");
	});

	it("red only locally, beside a production that holds it, is not broken: work in progress", () => {
		const r = standingOf(
			entry(),
			[seen("local", "red"), seen("production", "green")],
			[row("A1", "passing")],
		);
		expect(r.standing).toBe("enforced");
		expect(r.health).toEqual({ local: "red", production: "green" });
	});

	it("red from the only source, local, is broken", () => {
		expect(standingOf(entry(), [seen("local", "red")], []).standing).toBe("broken");
	});

	it("a retired promise is retired whatever telemetry says", () => {
		expect(standingOf(entry({ state: "retired" }), [seen("local", "red")], []).standing).toBe(
			"retired",
		);
	});

	it("the last activity is the newest time any source saw it", () => {
		const r = standingOf(
			entry(),
			[
				seen("local", "green", "2026-10-09T10:00:00.000Z"),
				seen("production", "green", "2026-10-10T08:00:00.000Z"),
			],
			[],
		);
		expect(r.lastActivity).toBe("2026-10-10T08:00:00.000Z");
		expect(standingOf(entry(), [], []).lastActivity).toBeNull();
	});
});

const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 12, min));
const mark = (promise: string, outcome: "upheld" | "violated", min: number, traceId: string) =>
	({
		promise,
		outcome,
		traceId,
		spanId: `s-${traceId}`,
		service: "seat-holds",
		operation: "hold",
		at: at(min),
		symptom: outcome === "violated" ? "seat 4 held twice" : null,
		environment: "production",
	}) as MarkedSpan;

describe("A33 — standing reports the health the CLI and the editor report", () => {
	it("each promise's health per source is healthRows' and the health line's, promise by promise", async () => {
		const p = promiseProject({
			promises: [
				behaviourPromise("seats-held", { owner: "demo", domain: "demo" }),
				behaviourPromise("seats-quiet", { owner: "demo", domain: "demo" }),
				behaviourPromise("seats-released", { owner: "demo", domain: "demo" }),
			],
			domains: ["demo"],
			files: codeFilesFor("seats-held", "seats-quiet", "seats-released"),
		});
		const registry = (() => {
			const r = readPromises(p.planRoot);
			if (!r.ok) throw new Error("fixture registry did not read");
			return r.registry;
		})();
		const marks: MarkedSpansResult = {
			queryUrl: "https://example.fly.dev:16687",
			since: at(0),
			byPromise: new Map([
				[
					"seats-held",
					{
						violations: [mark("seats-held", "violated", 20, "t1")],
						truncated: false,
						lastUpheld: mark("seats-held", "upheld", 10, "u1"),
					},
				],
				["seats-quiet", { violations: [], truncated: false, lastUpheld: null }],
				[
					"seats-released",
					{
						violations: [],
						truncated: false,
						lastUpheld: mark("seats-released", "upheld", 15, "u2"),
					},
				],
			]),
		};
		const reads: SourceHealthRead[] = (["local", "production"] as const).map((name) => ({
			name,
			label: name,
			ok: true as const,
			at: at(30).toISOString(),
			marks,
		}));

		const standing = await readStanding(p.planRoot, { health: reads, resolve: async () => [] });
		expect(standing.map((s) => s.entry.name).sort()).toEqual([
			"seats-held",
			"seats-quiet",
			"seats-released",
		]);

		const line = healthLine(registry, reads, at(30));
		for (const s of standing) {
			for (const read of reads) {
				const want = healthRows(registry, read, ruleFor(read, reads))[s.entry.name]?.health;
				expect(s.health[read.name], `${s.entry.name} on ${read.name}`).toBe(want);
				const printed = line.sources
					.find((x) => x.name === read.name && x.ok)
					?.rows?.find((r) => r.promise === s.entry.name)?.state;
				expect(
					s.health[read.name],
					`${s.entry.name} on ${read.name} as the health line prints it`,
				).toBe(printed);
			}
		}
		expect(standing.find((s) => s.entry.name === "seats-held")?.standing).toBe("broken");
		expect(standing.find((s) => s.entry.name === "seats-held")?.health.production).toBe("red");
	});
});

const heardRow = (promise: string, at: string, source = "production"): HeardRow => ({
	at,
	promise,
	trace: `t-${at}`,
	incident: "INC-1",
	source,
});

describe("the dashboard's thirty days are the package's (plan-cockpit Build Phase 3)", () => {
	const now = Date.UTC(2026, 9, 10, 12, 0);

	it("counts the days with a break heard in thirty days and the days with none, for this promise only", () => {
		const r = standingOf(
			entry(),
			[seen("production", "green", "2026-10-09T10:00:00.000Z")],
			[],
			undefined,
			{
				now,
				heard: [
					heardRow("seats-held", "2026-10-08T09:00:00.000Z"),
					heardRow("seats-held", "2026-10-08T11:00:00.000Z"),
					heardRow("seats-held", "2026-10-03T11:00:00.000Z"),
					heardRow("seats-held", "2026-08-01T11:00:00.000Z"),
					heardRow("other-promise", "2026-10-08T11:00:00.000Z"),
				],
			},
		);
		// held is days an upheld run was seen (none handed in), not thirty minus broke.
		expect(r.thirtyDays).toEqual({ broke: 2, held: 0 });
	});

	it("a promise nothing has seen or heard has held null, not thirty", () => {
		expect(standingOf(entry(), [], [], undefined, { now, heard: [] }).thirtyDays).toEqual({
			broke: 0,
			held: null,
		});
	});

	it("the last break is the newest heard break, or the alarm source's sighting while broken and newer", () => {
		const heard = [heardRow("seats-held", "2026-10-08T09:00:00.000Z")];
		const quiet = standingOf(
			entry(),
			[seen("local", "green", "2026-10-09T10:00:00.000Z")],
			[],
			undefined,
			{
				now,
				heard,
			},
		);
		expect(quiet.lastBreak).toBe("2026-10-08T09:00:00.000Z");
		const live = standingOf(
			entry(),
			[seen("local", "red", "2026-10-10T08:00:00.000Z")],
			[],
			undefined,
			{
				now,
				heard,
			},
		);
		expect(live.lastBreak).toBe("2026-10-10T08:00:00.000Z");
		expect(standingOf(entry(), [], [], undefined, { now, heard: [] }).lastBreak).toBeNull();
	});
});

describe("A40 — the thirty days count days", () => {
	const now = Date.UTC(2026, 9, 10, 12, 0);

	it("five violations heard on one day are one broken day", () => {
		const r = standingOf(
			entry(),
			[seen("production", "green", "2026-10-09T10:00:00.000Z")],
			[],
			undefined,
			{
				now,
				heard: [1, 2, 3, 4, 5].map((n) => heardRow("seats-held", `2026-10-08T0${n}:00:00.000Z`)),
			},
		);
		expect(r.thirtyDays).toEqual({ broke: 1, held: 0 });
	});
});

describe("cockpit-audit-fixes A1–A4 — thirty days that say only what was seen", () => {
	// promise: the-thirty-days-say-only-what-was-seen
	const now = Date.UTC(2026, 9, 10, 12, 0);
	const upheld = (...days: string[]) => days.map((d) => `${d}T10:00:00.000Z`);

	it("A1 upheld on three days and broken on one is held 3, broke 1", () => {
		const r = standingOf(
			entry(),
			[seen("production", "green", "2026-10-09T10:00:00.000Z")],
			[],
			undefined,
			{
				now,
				heard: [heardRow("seats-held", "2026-10-08T09:00:00.000Z")],
				upheld: upheld("2026-10-05", "2026-10-06", "2026-10-07"),
			} as never,
		);
		expect(r.thirtyDays).toEqual({ broke: 1, held: 3 });
	});

	it("A2 a promise with one heard break and no upheld run has held 0, not twenty-nine", () => {
		const r = standingOf(entry(), [], [], undefined, {
			now,
			heard: [heardRow("seats-held", "2026-10-08T09:00:00.000Z")],
			upheld: [],
		} as never);
		expect(r.thirtyDays).toEqual({ broke: 1, held: 0 });
	});

	it("A3 five violations heard on one day are one broken day", () => {
		const r = standingOf(entry(), [], [], undefined, {
			now,
			heard: [1, 2, 3, 4, 5].map((n) => heardRow("seats-held", `2026-10-08T0${n}:00:00.000Z`)),
		});
		expect(r.thirtyDays.broke).toBe(1);
	});

	it("A4 a break heard under an earlier name counts on its day, and a day with a break is not held", () => {
		const r = standingOf(entry({ aliases: ["seat-held"] }), [], [], undefined, {
			now,
			heard: [heardRow("seat-held", "2026-10-08T09:00:00.000Z")],
			upheld: upheld("2026-10-08", "2026-10-07"),
		} as never);
		expect(r.thirtyDays).toEqual({ broke: 1, held: 1 });
	});
});

describe("A13 — the thirty days count a signal the same way whichever word it says", () => {
	// promise: the-thirty-days-say-only-what-was-seen
	// promise: a-promise-is-upheld-or-broken
	const now = Date.UTC(2026, 9, 10, 12, 0);
	const NAME = "seats-held";
	const endpoint = jaegerEndpoint("http://jaeger.test");
	afterEach(() => vi.unstubAllGlobals());

	const span = (spanId: string, outcome: string, iso: string): HeldSpan => ({
		service: "seat-holds",
		name: "hold",
		spanId,
		at: new Date(iso),
		tags: { "indusk.promise": NAME, "indusk.promise.outcome": outcome },
	});

	/**
	 * The same two days in each world: the 7th held (one upheld run), the 8th
	 * with an upheld run and a break the recorder heard — only the word on the
	 * break signal differs.
	 */
	async function thirtyDaysWith(breakWords: string[]) {
		const spans = [
			span("u7", "upheld", "2026-10-07T09:00:00.000Z"),
			span("u8", "upheld", "2026-10-08T09:00:00.000Z"),
			...breakWords.map((w, i) => span(`b${i}`, w, `2026-10-08T1${i}:00:00.000Z`)),
		];
		vi.stubGlobal("fetch", fakeJaegerFetch(spans));
		const p = promiseProject({
			promises: [behaviourPromise(NAME, { owner: "demo", domain: "demo" })],
			domains: ["demo"],
			files: codeFilesFor(NAME),
		});
		const marks = await markedSpans({
			promises: [NAME],
			since: new Date(Date.UTC(2026, 8, 11)),
			endpoint,
		});
		const health: SourceHealthRead[] = [
			{ name: "local", label: "local", ok: true, at: new Date(now).toISOString(), marks },
		];
		const from = new Date(Date.UTC(2026, 8, 11));
		const window = await marksBetween(endpoint, {
			service: "seat-holds",
			name: NAME,
			promise: NAME,
			from,
			to: new Date(now),
			timeoutMs: 1_000,
		});
		const read = async (): Promise<TimelineRead[]> => [
			{
				name: "local",
				label: "local",
				ok: true,
				from: from.toISOString(),
				to: new Date(now).toISOString(),
				byPromise: new Map([
					[
						NAME,
						{
							atLeast: [],
							marks: window.marks.map((m) => ({
								at: m.at.toISOString(),
								outcome: m.outcome,
								traceId: m.traceId,
								environment: m.environment,
							})),
						},
					],
				]),
			},
		];
		const [row] = await readStanding(p.planRoot, {
			health,
			now: () => now,
			resolve: async () => [{ name: "local", ok: true, source: { label: "local" } as never }],
			read,
			heard: [heardRow(NAME, "2026-10-08T10:00:00.000Z", "local")],
		});
		return { standing: row.standing, thirtyDays: row.thirtyDays, lastBreak: row.lastBreak };
	}

	const EXPECTED = {
		standing: "broken",
		thirtyDays: { broke: 1, held: 1 },
		lastBreak: "2026-10-08T10:00:00.000Z",
	};

	it("signals saying broken: the promise is broken, one day broke, one held", async () => {
		expect(await thirtyDaysWith(["broken"])).toEqual(EXPECTED);
	});

	it("signals saying violated: the same counts", async () => {
		expect(await thirtyDaysWith(["violated"])).toEqual(EXPECTED);
	});

	it("a mix of both words: the same counts", async () => {
		expect(await thirtyDaysWith(["violated", "broken"])).toEqual(EXPECTED);
	});
});
