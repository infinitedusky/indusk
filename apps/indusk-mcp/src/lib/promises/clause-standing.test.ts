import { rmSync } from "node:fs";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { type PromiseProject, promiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { clauseStanding, worstStanding } from "./clause-standing.js";
import type { SourceHealthRead } from "./health.js";
import type { PromiseEntry } from "./registry.js";
import { readStanding } from "./standing.js";
import { formatStatus } from "./status.js";
import type { MarkedSpansResult } from "./telemetry.js";
import type { TimelineMark, TimelineRead } from "./timeline.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/upheld-by-its-signal
// clause: a-clause-is-proved-twice/no-signal-is-not-holding

/**
 * A4, A5, A8, A12, A13, A14 and the standing half of A15 of mark-first: a
 * clause reads from its own signal, never from its tests; no report and a blind
 * watcher both read `no signal`; a promise is its worst clause. The rule is
 * decided from values handed in; the second half reads through `readStanding`
 * with a stubbed window, so what the promise page, `promises status` and the
 * admin show is the one reader.
 */

const split = { kind: "split" as const };
const limit = { kind: "limit" as const };
const up = (at: string, extra: object = {}) => ({ outcome: "upheld" as const, at, ...extra });
const down = (at: string, extra: object = {}) => ({ outcome: "broken" as const, at, ...extra });

describe("clauseStanding", () => {
	it("A4 — a clause whose signal reported upheld reads holding", () => {
		const reports = [up("2026-10-01T00:00:00Z")];
		expect(clauseStanding(split, { reports, heartbeatOk: true })).toBe("holding");
	});

	it("A5 — a clause with no report reads no signal; tests are not an input", () => {
		expect(clauseStanding(split, { reports: [], heartbeatOk: true })).toBe("no-signal");
	});

	it("A12 — a clause nothing ever reported is never holding", () => {
		for (const kind of [split, limit]) {
			expect(clauseStanding(kind, { reports: [], heartbeatOk: true })).not.toBe("holding");
		}
	});

	it("A13 — a silent watcher is no signal even after an upheld report", () => {
		const reports = [up("2026-10-01T00:00:00Z")];
		expect(clauseStanding(split, { reports, heartbeatOk: false })).toBe("no-signal");
	});

	it("a break stays broken when the watcher has gone silent: it was heard", () => {
		expect(
			clauseStanding(split, { reports: [down("2026-10-01T00:00:00Z")], heartbeatOk: false }),
		).toBe("broken");
	});

	it("A8 — a split is broken by missing its budget at its point: its newest report decides", () => {
		const missed = [up("2026-10-01T00:00:00Z"), down("2026-10-02T00:00:00Z")];
		const recovered = [down("2026-10-01T00:00:00Z"), up("2026-10-02T00:00:00Z")];
		expect(clauseStanding(split, { reports: missed, heartbeatOk: true })).toBe("broken");
		expect(clauseStanding(split, { reports: recovered, heartbeatOk: true })).toBe("holding");
	});

	it("A8 — a limit is broken by one report over its bound, however many were inside", () => {
		const reports = [
			up("2026-10-01T00:00:00Z"),
			down("2026-10-02T00:00:00Z"),
			up("2026-10-03T00:00:00Z"),
			up("2026-10-04T00:00:00Z"),
		];
		expect(clauseStanding(limit, { reports, heartbeatOk: true })).toBe("broken");
	});

	it("A8 — a report that measured past its bound breaks the clause though it says upheld", () => {
		const reports = [up("2026-10-01T00:00:00Z", { value: 1400, bound: 1000 })];
		expect(clauseStanding(limit, { reports, heartbeatOk: true })).toBe("broken");
		const inside = [up("2026-10-01T00:00:00Z", { value: 800, bound: 1000 })];
		expect(clauseStanding(limit, { reports: inside, heartbeatOk: true })).toBe("holding");
	});

	it("A14 — the worst standing is broken, then no signal, then holding", () => {
		expect(worstStanding(["holding", "no-signal"])).toBe("no-signal");
		expect(worstStanding(["holding", "no-signal", "broken"])).toBe("broken");
		expect(worstStanding(["holding", "holding"])).toBe("holding");
		expect(worstStanding([])).toBeNull();
	});
});

describe("a promise's clauses, read as the promise page, status and the admin read them", () => {
	const NAME = "seats-reach";
	const OTHER = "seats-rest";
	const now = Date.UTC(2026, 9, 10, 12, 0);
	let fixture: PromiseProject | null = null;
	afterEach(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
		fixture = null;
	});

	const promiseFile = (name: string, clauses: object[], state = "enforced") =>
		matter.stringify(`The ${name} holds.\n\n## History\n- 2026-10-16 — declared.\n`, {
			name,
			kind: "state",
			lifetime: "holds",
			state,
			domain: "seating",
			owner: "seat-holds",
			sites: [],
			tests: [],
			incidents: [],
			clauses,
		});

	const clauses = [
		{ name: "reaches-seat", kind: "split", statement: "A seat is reached in time." },
		{ name: "never-twice", kind: "limit", statement: "No seat is held twice." },
	];

	/** The standing of each promise with `marks` reported in the window and the watcher blind or not. */
	async function stand(
		promises: Record<string, object[]>,
		marks: Record<string, TimelineMark[]>,
		opts: { blind?: boolean } = {},
	) {
		fixture = promiseProject({
			domains: ["seating"],
			promises: Object.entries(promises).map(([name, cs]) => ({
				name,
				kind: "state" as const,
				state: "enforced" as const,
				domain: "seating",
				owner: "seat-holds",
				raw: promiseFile(name, cs),
			})),
		});
		const marksResult = {
			queryUrl: "local",
			since: new Date(0),
			byPromise: new Map(),
		} as MarkedSpansResult;
		const health: SourceHealthRead[] = [
			opts.blind
				? {
						name: "local",
						label: "local",
						ok: false,
						unknownSince: null,
						where: "local",
						blind: { intake: "x" },
					}
				: {
						name: "local",
						label: "local",
						ok: true,
						at: new Date(now).toISOString(),
						marks: marksResult,
					},
		];
		const from = new Date(now - 30 * 86_400_000);
		const read = async (): Promise<TimelineRead[]> => [
			{
				name: "local",
				label: "local",
				ok: true,
				from: from.toISOString(),
				to: new Date(now).toISOString(),
				byPromise: new Map(
					Object.entries(marks).map(([name, list]) => [name, { atLeast: [], marks: list }]),
				),
			},
		];
		return readStanding(fixture.planRoot, {
			health,
			now: () => now,
			heard: [],
			resolve: async () => [{ name: "local", ok: true, source: { label: "local" } as never }],
			read,
		});
	}

	const mark = (clause: string, outcome: "upheld" | "broken", at: string): TimelineMark => ({
		at,
		outcome,
		traceId: `t-${clause}-${at}`,
		environment: null,
		clause,
	});

	it("A4 — a clause whose signal reported upheld reads holding, and so does its promise", async () => {
		const rows = await stand(
			{ [NAME]: clauses },
			{
				[NAME]: [
					mark("reaches-seat", "upheld", "2026-10-09T10:00:00.000Z"),
					mark("never-twice", "upheld", "2026-10-09T10:00:00.000Z"),
				],
			},
		);
		const [row] = rows;
		expect(row?.clauses?.map((c) => [c.clause, c.standing])).toEqual([
			["reaches-seat", "holding"],
			["never-twice", "holding"],
		]);
		expect(row?.signal).toBe("holding");
	});

	it("A12 — a clause whose signal never reported reads no signal, never holding", async () => {
		const [row] = await stand({ [NAME]: clauses }, {});
		expect(row?.clauses?.map((c) => c.standing)).toEqual(["no-signal", "no-signal"]);
		expect(row?.signal).toBe("no-signal");
	});

	it("A13 — a clause that last reported upheld reads no signal once its watcher has gone blind", async () => {
		const [row] = await stand(
			{ [NAME]: clauses },
			{ [NAME]: [mark("reaches-seat", "upheld", "2026-10-09T10:00:00.000Z")] },
			{ blind: true },
		);
		expect(row?.clauses?.[0]?.standing).toBe("no-signal");
	});

	it("A14 — one clause upheld and another with no signal is not holding: the worst decides", async () => {
		const [row] = await stand(
			{ [NAME]: clauses },
			{ [NAME]: [mark("reaches-seat", "upheld", "2026-10-09T10:00:00.000Z")] },
		);
		expect(row?.signal).toBe("no-signal");
	});

	it("A7 — a clause whose signal reports broken reads broken, and so does its promise", async () => {
		const [row] = await stand(
			{ [NAME]: clauses },
			{
				[NAME]: [
					mark("reaches-seat", "upheld", "2026-10-09T10:00:00.000Z"),
					mark("never-twice", "broken", "2026-10-09T11:00:00.000Z"),
				],
			},
		);
		expect(row?.clauses?.find((c) => c.clause === "never-twice")?.standing).toBe("broken");
		expect(row?.signal).toBe("broken");
		expect(row?.standing).toBe("broken");
	});

	it("A15 — a promise made only of resting clauses has the standing of those it rests on", async () => {
		const resting = [{ name: "rests-on-seats", kind: "rests-on", rests_on: NAME }];
		const rows = await stand(
			{ [NAME]: clauses, [OTHER]: resting },
			{
				[NAME]: [
					mark("reaches-seat", "upheld", "2026-10-09T10:00:00.000Z"),
					mark("never-twice", "upheld", "2026-10-09T10:00:00.000Z"),
				],
			},
		);
		const resting1 = rows.find((r) => r.entry.name === OTHER);
		expect(resting1?.clauses?.[0]).toMatchObject({
			clause: "rests-on-seats",
			standing: "holding",
			restsOn: NAME,
		});
		expect(resting1?.signal).toBe("holding");

		const silent = await stand({ [NAME]: clauses, [OTHER]: resting }, {});
		expect(silent.find((r) => r.entry.name === OTHER)?.signal).toBe("no-signal");
	});
});

describe("A4 and A12 — `promises status` says the same words", () => {
	const entry: PromiseEntry = {
		name: "seats-reach",
		kind: "state",
		lifetime: "holds",
		state: "enforced",
		domain: "seating",
		owner: "seat-holds",
		statement: "Seats are reached.",
		sites: [],
		tests: [],
		incidents: [],
		aliases: [],
		file: "seats-reach.md",
		clauses: [
			{ name: "reaches-seat", kind: "split" },
			{ name: "never-twice", kind: "limit" },
		],
	};
	const span = (outcome: "upheld" | "broken") => ({
		promise: "seats-reach",
		outcome,
		traceId: "t",
		spanId: "s",
		service: "seats",
		operation: "op",
		at: new Date("2026-10-09T10:00:00Z"),
		symptom: null,
		environment: null,
		clause: "reaches-seat",
	});

	it("a clause that reported upheld says holding, one that never reported says no signal", () => {
		const marks: MarkedSpansResult = {
			queryUrl: "http://localhost:1",
			since: new Date("2026-10-01T00:00:00Z"),
			byPromise: new Map([
				[
					"seats-reach",
					{
						violations: [],
						truncated: false,
						lastUpheld: span("upheld"),
						byClause: { "reaches-seat": { violations: [], lastUpheld: span("upheld") } },
					},
				],
			]),
		};
		const text = formatStatus([entry], marks, 7);
		expect(text).toContain("clause reaches-seat (split): holding");
		expect(text).toContain("clause never-twice (limit): no signal");
	});

	it("a promise nothing reported says no signal for every clause", () => {
		const marks: MarkedSpansResult = {
			queryUrl: "http://localhost:1",
			since: new Date("2026-10-01T00:00:00Z"),
			byPromise: new Map(),
		};
		const text = formatStatus([entry], marks, 7);
		expect(text).toContain("clause reaches-seat (split): no signal");
		expect(text).not.toContain(": holding");
	});
});
