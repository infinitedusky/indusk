import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	behaviourPromise,
	codeFilesFor,
	openIncidentSpec,
	promiseProject,
} from "../../__tests__/helpers/promises-fixture.js";
import type { SourceHealthRead } from "./health.js";
import { appendHeard } from "./heard.js";
import { type ProofDeps, proofOf } from "./proof.js";
import type { SourceRead } from "./sources.js";
import type { MarkedSpan, MarkedSpansResult } from "./telemetry.js";
import type { TimelineMark, TimelineRead } from "./timeline.js";

// promise: a-promise-page-shows-its-proof, the-admin-keeps-what-it-heard

/**
 * plan-cockpit A25–A30, the package's halves: what a promise's page shows as
 * its proof — the test rows that name it, where it was marked in the running
 * system, thirty days held and broken per source, its dated history, and the
 * banner for a break the tests do not catch. Every read is handed in: no
 * Jaeger, no clock, no wait.
 */

const PROMISE = "seat-released";
const OWNER = "seat-holds";
const NOW = Date.UTC(2026, 9, 10, 12, 0);

const impl = (title: string, rows: [string, string, string][]) =>
	[
		"---",
		`title: "${title}"`,
		"status: completed",
		"test_purpose: required",
		"---",
		"",
		`# ${title}`,
		"",
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State | Level | For | Test |",
		"|----|---------|-------------|-----------|-------|-------|-----|------|",
		...rows.map(
			([id, state, file]) =>
				`| ${id} | a seat is released | Phase 1 | Phase 1 | ${state} | unit | promise: ${PROMISE} | ${file} |`,
		),
		"",
	].join("\n");

const HISTORY_PROMISE = [
	"---",
	`name: ${PROMISE}`,
	"kind: behaviour",
	"lifetime: holds",
	"state: enforced",
	"domain: seating",
	`owner: ${OWNER}`,
	"sites:",
	`  - src/${PROMISE}.ts`,
	"tests:",
	`  - src/${PROMISE}.test.ts`,
	"incidents:",
	"  - i-2026-10-05-seat-released",
	"---",
	"",
	"A held seat is released when its player leaves.",
	"",
	"## History",
	"- 2026-09-20 — declared (seat-holds), from its planning conversation.",
	"- 2026-09-25 — enforced, confirmed for seat-holds: proven by row A1.",
	"- 2026-10-02 — changed (seat-fixes): now also covers a timed-out hold.",
	"",
].join("\n");

const day = (n: number) => new Date(Date.UTC(2026, 8, 10 + n, 9, 0)).toISOString(); // n=1 is 2026-09-11

let home: string;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "proof-home-"));
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
});

function project() {
	const fx = promiseProject({
		archivedPlans: [OWNER],
		activePlans: ["seat-fixes"],
		planFiles: {
			[`archive/${OWNER}/impl.md`]: impl(OWNER, [
				["A1", "passing", "src/a.test.ts"],
				["A2", "passing", "src/b.test.ts, src/c.test.ts"],
			]),
			"seat-fixes/impl.md": impl("seat-fixes", [["A7", "written", "src/d.test.ts"]]),
		},
		promises: [
			{ ...behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" }), raw: HISTORY_PROMISE },
		],
		incidents: [
			openIncidentSpec("i-2026-10-05-seat-released", PROMISE, {
				opened: "2026-10-05T10:00:00Z",
				status: "fixed",
				fixed: "2026-10-06T08:00:00Z",
				traces: ["t-incident"],
			}),
		],
		domains: ["seating"],
		files: codeFilesFor(PROMISE),
		extraConfig: {
			promises: { domains: ["seating"], jaeger: { url: "https://j.example", credential_env: "X" } },
		},
	});
	cleanups.push(() => rmSync(fx.root, { recursive: true, force: true }));
	return fx;
}

const span = (
	outcome: "upheld" | "violated",
	service: string,
	operation: string,
	at: string,
	traceId: string,
): MarkedSpan =>
	({
		promise: PROMISE,
		outcome,
		traceId,
		spanId: traceId,
		service,
		operation,
		at: new Date(at),
		symptom: outcome === "violated" ? "a held seat was not released" : null,
		environment: "production",
	}) as MarkedSpan;

function marksRead(
	name: "local" | "production",
	violations: MarkedSpan[],
	lastUpheld: MarkedSpan | null,
): SourceRead {
	const marks: MarkedSpansResult = {
		queryUrl: name,
		since: new Date(NOW - 30 * 86_400_000),
		byPromise: new Map([[PROMISE, { violations, truncated: false, lastUpheld }]]),
	};
	return { name, label: name, ok: true, marks };
}

/** A store that holds these upheld marks per source; the real window reader slices through it. */
function storeOf(
	upheld: Record<string, TimelineMark[]>,
): Pick<ProofDeps, "now" | "resolve" | "read"> {
	return {
		now: () => NOW,
		resolve: async () =>
			(["local", "production"] as const).map((name) => ({
				name,
				ok: true as const,
				source: { label: name } as never,
			})),
		read: async (_root, _registry, opts): Promise<TimelineRead[]> => {
			const name = opts.source ?? "local";
			const inside = (upheld[name] ?? []).filter(
				(m) => Date.parse(m.at) >= opts.from.getTime() && Date.parse(m.at) < opts.to.getTime(),
			);
			return [
				{
					name,
					label: name,
					ok: true,
					from: opts.from.toISOString(),
					to: opts.to.toISOString(),
					byPromise: new Map([[PROMISE, { marks: inside, atLeast: [] }]]),
				},
			];
		},
	};
}

const upheld = (at: string, traceId: string): TimelineMark => ({
	at,
	outcome: "upheld",
	traceId,
	environment: "production",
});

function healthRead(red: boolean): SourceHealthRead[] {
	const marks: MarkedSpansResult = {
		queryUrl: "production",
		since: new Date(NOW - 7 * 86_400_000),
		byPromise: new Map([
			[
				PROMISE,
				{
					violations: red ? [span("violated", "seat-holds", "release", day(29), "t-live")] : [],
					truncated: false,
					lastUpheld: span("upheld", "seat-holds", "release", day(28), "u-live"),
				},
			],
		]),
	};
	return [
		{ name: "production", label: "production", ok: true, at: new Date(NOW).toISOString(), marks },
	];
}

const deps = (over: ProofDeps = {}): ProofDeps => ({
	home,
	...storeOf({}),
	marks: async () => [],
	health: healthRead(false),
	...over,
});

describe("A25 — every test row that names the promise, active or archived", () => {
	it("lists each row with its state, its plan and its test files", async () => {
		const fx = project();
		const proof = await proofOf(fx.planRoot, PROMISE, deps());
		const rows = (proof?.rows ?? []).map((r) => [r.id, r.state, r.plan, r.archived, r.tests]);
		expect(rows).toEqual(
			expect.arrayContaining([
				["A1", "passing", OWNER, true, ["src/a.test.ts"]],
				["A2", "passing", OWNER, true, ["src/b.test.ts", "src/c.test.ts"]],
				["A7", "written", "seat-fixes", false, ["src/d.test.ts"]],
			]),
		);
		expect(rows).toHaveLength(3);
	});

	it("is null for a name the registry does not hold", async () => {
		const fx = project();
		expect(await proofOf(fx.planRoot, "no-such-promise", deps())).toBeNull();
	});
});

describe("A26 — where the promise was marked, and when last held or broken", () => {
	it("groups by service and operation, each with its last held and last broken", async () => {
		const fx = project();
		const proof = await proofOf(
			fx.planRoot,
			PROMISE,
			deps({
				marks: async () => [
					marksRead(
						"production",
						[
							span("violated", "seat-holds", "release", "2026-10-09T10:00:00Z", "t2"),
							span("violated", "seat-holds", "release", "2026-10-08T10:00:00Z", "t1"),
						],
						span("upheld", "seat-holds", "release", "2026-10-09T11:00:00Z", "u1"),
					),
					marksRead("local", [], span("upheld", "seat-web", "leave", "2026-10-10T08:00:00Z", "u2")),
				],
			}),
		);
		expect(proof?.seen).toBe(true);
		expect(proof?.marks).toEqual([
			{
				service: "seat-holds",
				operation: "release",
				lastHeld: "2026-10-09T11:00:00.000Z",
				lastBroken: "2026-10-09T10:00:00.000Z",
			},
			{
				service: "seat-web",
				operation: "leave",
				lastHeld: "2026-10-10T08:00:00.000Z",
				lastBroken: null,
			},
		]);
	});

	it("a promise never seen says so: no marks, seen false", async () => {
		const fx = project();
		const proof = await proofOf(
			fx.planRoot,
			PROMISE,
			deps({ marks: async () => [marksRead("local", [], null)] }),
		);
		expect(proof?.marks).toEqual([]);
		expect(proof?.seen).toBe(false);
	});
});

describe("A27 — thirty days, held and broken, per source", () => {
	it("has thirty days for each source, today last; heard rows are broken, the store's upheld are held", async () => {
		const fx = project();
		appendHeard(home, [
			{ at: day(3), promise: PROMISE, trace: "h1", incident: "i1", source: "deployed" },
			{ at: day(3), promise: PROMISE, trace: "h2", incident: "i1", source: "deployed" },
			{ at: day(10), promise: PROMISE, trace: "h3", incident: "i1", source: "local" },
		]);
		const proof = await proofOf(
			fx.planRoot,
			PROMISE,
			deps({
				...storeOf({
					production: [upheld(day(3), "p1"), upheld(day(3), "p2"), upheld(day(4), "p3")],
					local: [upheld(day(10), "l1")],
				}),
			}),
		);
		const production = proof?.days.production ?? [];
		const local = proof?.days.local ?? [];
		expect(production).toHaveLength(30);
		expect(local).toHaveLength(30);
		expect(production[0]?.day).toBe("2026-09-11");
		expect(production[29]?.day).toBe("2026-10-10");
		expect(production[2]).toEqual({ day: "2026-09-13", held: 2, broken: 2 });
		expect(production[3]).toEqual({ day: "2026-09-14", held: 1, broken: 0 });
		expect(local[9]).toEqual({ day: "2026-09-20", held: 1, broken: 1 });
		expect(production[9]?.broken).toBe(0);
	});
});

describe("A28 — the history, dated", () => {
	it("lists declared, confirmed and changed from the promise's file and each incident, oldest first", async () => {
		const fx = project();
		const proof = await proofOf(fx.planRoot, PROMISE, deps());
		const events = (proof?.history ?? []).map((e) => [e.at.slice(0, 10), e.kind]);
		expect(events).toEqual([
			["2026-09-20", "declared"],
			["2026-09-25", "confirmed"],
			["2026-10-02", "changed"],
			["2026-10-05", "incident"],
			["2026-10-06", "fixed"],
		]);
		const incident = proof?.history.find((e) => e.kind === "incident");
		expect(incident?.text).toContain("i-2026-10-05-seat-released");
	});
});

describe("A29 — a break the tests do not catch", () => {
	it("broken while every naming row passes says the tests miss the case", async () => {
		const fx = project();
		// A7 is written, not passing: close it so every naming row passes.
		const closed = promiseProject({
			archivedPlans: [OWNER],
			planFiles: {
				[`archive/${OWNER}/impl.md`]: impl(OWNER, [["A1", "passing", "src/a.test.ts"]]),
			},
			promises: [
				{ ...behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" }), raw: HISTORY_PROMISE },
			],
			domains: ["seating"],
			files: codeFilesFor(PROMISE),
		});
		cleanups.push(() => rmSync(closed.root, { recursive: true, force: true }));
		const broken = await proofOf(closed.planRoot, PROMISE, deps({ health: healthRead(true) }));
		expect(broken?.banner.testsMissTheCase).toBe(true);
		const holding = await proofOf(closed.planRoot, PROMISE, deps({ health: healthRead(false) }));
		expect(holding?.banner.testsMissTheCase).toBe(false);
		// A row that is not passing is a reason the break is unsurprising: no banner.
		const open = await proofOf(fx.planRoot, PROMISE, deps({ health: healthRead(true) }));
		expect(open?.banner.testsMissTheCase).toBe(false);
	});
});

describe("A30 — what was heard while no page was open", () => {
	it("a violation appended with no reader running is on its day", async () => {
		const fx = project();
		appendHeard(home, [
			{ at: day(27), promise: PROMISE, trace: "late", incident: "i1", source: "deployed" },
		]);
		const proof = await proofOf(fx.planRoot, PROMISE, deps());
		const days = proof?.days.production ?? [];
		expect(days.find((d) => d.day === "2026-10-07")?.broken).toBe(1);
		expect(days.reduce((n, d) => n + d.broken, 0)).toBe(1);
	});

	it("another promise's heard rows are not this promise's days", async () => {
		const fx = project();
		appendHeard(home, [
			{ at: day(27), promise: "something-else", trace: "x", incident: "i9", source: "deployed" },
		]);
		const proof = await proofOf(fx.planRoot, PROMISE, deps());
		expect((proof?.days.production ?? []).reduce((n, d) => n + d.broken, 0)).toBe(0);
	});
});
