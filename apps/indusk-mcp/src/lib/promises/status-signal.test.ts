import type { Tracer } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import type { PromiseEntry } from "./registry.js";
import { type ShownClause, shownClauses } from "./status.js";
import { markStatusSignal, statusVerdict } from "./status-signal.js";
import type { MarkedSpan, MarkedSpansResult } from "./telemetry.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/no-signal-is-not-holding

/**
 * A39 of mark-first (Build Phase 7, falsification): `indusk promises status`
 * writes the signal of `no-signal-is-not-holding` through the commands'
 * tracer. It judges what it is about to show: upheld when every clause it
 * shows as holding has a report and a live watcher; broken, naming the
 * clause, when one is shown holding without. Nothing shown, nothing written.
 */

interface Captured {
	attrs: Record<string, unknown>;
	events: Array<{ name: string; attrs?: Record<string, unknown> }>;
	ended: boolean;
}

function capture(): { tracer: Tracer; spans: Captured[] } {
	const spans: Captured[] = [];
	const tracer = {
		startSpan: () => {
			const s: Captured = { attrs: {}, events: [], ended: false };
			spans.push(s);
			return {
				setAttribute: (k: string, v: unknown) => {
					s.attrs[k] = v;
				},
				addEvent: (name: string, attrs?: Record<string, unknown>) => {
					s.events.push({ name, attrs });
				},
				end: () => {
					s.ended = true;
				},
			};
		},
	} as unknown as Tracer;
	return { tracer, spans };
}

const AT = "2026-10-19T10:00:00.000Z";
const holding = (clause: string, lastReport: string | null = AT): ShownClause => ({
	promise: "p",
	clause,
	standing: "holding",
	lastReport,
});

describe("A39 — promises status writes the signal of no-signal-is-not-holding", () => {
	it("is upheld when every clause shown holding has a report and the watcher is live", () => {
		const noSignal: ShownClause = {
			promise: "p",
			clause: "b",
			standing: "no-signal",
			lastReport: null,
		};
		expect(statusVerdict([holding("a"), noSignal], true)).toEqual({ outcome: "upheld" });
	});

	it("is broken, naming the clause, when one is shown holding with no report", () => {
		const v = statusVerdict([holding("a"), holding("b", null)], true);
		expect(v?.outcome).toBe("broken");
		expect(v?.symptom).toMatch(/p\/b/);
		expect(v?.symptom).not.toMatch(/p\/a\b/);
	});

	it("is broken when a clause is shown holding while the watcher is blind", () => {
		const v = statusVerdict([holding("a")], false);
		expect(v?.outcome).toBe("broken");
		expect(v?.symptom).toMatch(/p\/a/);
	});

	it("writes nothing when no clause is shown", () => {
		expect(statusVerdict([], true)).toBe(null);
	});

	it("the clauses it judges are the ones the status text shows", () => {
		const promise = {
			name: "p",
			kind: "state",
			state: "enforced",
			domain: "d",
			clauses: [
				{ name: "a", kind: "split", statement: "A." },
				{ name: "b", kind: "limit", statement: "B." },
				{ name: "c", kind: "rests-on", restsOn: "q", statement: "C." },
			],
		} as unknown as PromiseEntry;
		const upheld = {
			promise: "p",
			outcome: "upheld",
			at: new Date(AT),
			clause: "a",
		} as unknown as MarkedSpan;
		const marks: MarkedSpansResult = {
			queryUrl: "http://jaeger.test",
			since: new Date("2026-10-01T00:00:00Z"),
			byPromise: new Map([
				[
					"p",
					{
						violations: [],
						truncated: false,
						lastUpheld: upheld,
						byClause: { a: { violations: [], lastUpheld: upheld } },
					},
				],
			]),
		};
		expect(shownClauses([promise], marks)).toEqual([
			{ promise: "p", clause: "a", standing: "holding", lastReport: AT },
			{ promise: "p", clause: "b", standing: "no-signal", lastReport: null },
		]);
	});

	it("writes one span through the tracer, naming the promise and the clause", async () => {
		const { tracer, spans } = capture();
		await markStatusSignal(
			"/nowhere",
			{ outcome: "broken", symptom: "p/b shown holding with no report" },
			tracer,
		);
		expect(spans).toHaveLength(1);
		expect(spans[0]?.attrs["indusk.promise"]).toBe("a-clause-is-proved-twice");
		expect(spans[0]?.attrs["indusk.clause"]).toBe("no-signal-is-not-holding");
		expect(spans[0]?.attrs["indusk.promise.outcome"]).toBe("broken");
		expect(JSON.stringify(spans[0]?.events)).toContain("p/b shown holding with no report");
		expect(spans[0]?.ended).toBe(true);
	});
});
