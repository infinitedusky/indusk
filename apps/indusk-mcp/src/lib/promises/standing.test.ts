import { describe, expect, it } from "vitest";
import {
	behaviourPromise,
	codeFilesFor,
	promiseProject,
} from "../../__tests__/helpers/promises-fixture.js";
import { healthLine, healthRows, ruleFor, type SourceHealthRead } from "./health.js";
import { type PromiseEntry, readPromises } from "./registry.js";
import type { PlanRow } from "./rows.js";
import { readStanding, type SourcedHealth, standingOf } from "./standing.js";
import type { MarkedSpan, MarkedSpansResult } from "./telemetry.js";

// promise: every-promise-is-listed, the-editor-shows-the-same-health-as-the-admin

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

		const standing = await readStanding(p.planRoot, { health: reads });
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
