// clause: a-decision-is-a-question/asked-with-a-recommendation
// clause: a-decision-is-a-question/never-decided-silently
// clause: the-cost-sets-the-wait/holds-by-default
// clause: the-cost-sets-the-wait/the-setting-decides
// clause: the-cost-sets-the-wait/a-hold-frees-the-slot
// clause: what-was-agreed-is-never-cheap/never-timed-out
// clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan
// clause: a-late-answer-opens-a-follow-on/every-decision-stays
// clause: a-release-waits-for-a-known-wrong/release-refuses
// clause: a-release-waits-for-a-known-wrong/landing-never-waits
import type { Tracer } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { CLAUSES, reportClause } from "./signals.js";

/**
 * decisions-as-questions T25: each place that decides a clause reports it — upheld when
 * what it decided holds, broken naming what did not — and a failed report never fails
 * what reported it. The tracer is a capture, as `closing-signal.test.ts`'s is.
 */
interface Captured {
	name: string;
	attrs: Record<string, unknown>;
	events: Array<{ name: string; attrs?: Record<string, unknown> }>;
	ended: boolean;
}

function capture(): { tracer: Tracer; spans: Captured[] } {
	const spans: Captured[] = [];
	const tracer = {
		startSpan: (name: string) => {
			const s: Captured = { name, attrs: {}, events: [], ended: false };
			spans.push(s);
			return {
				setAttribute: (k: string, v: unknown) => {
					s.attrs[k] = v;
				},
				addEvent: (n: string, attrs?: Record<string, unknown>) => {
					s.events.push({ name: n, attrs });
				},
				end: () => {
					s.ended = true;
				},
			};
		},
	} as unknown as Tracer;
	return { tracer, spans };
}

describe("T25 — a clause is reported by the place that decides it", () => {
	it("names every clause of the plan's five promises", () => {
		expect(CLAUSES).toEqual({
			"asked-with-a-recommendation": "a-decision-is-a-question",
			"never-decided-silently": "a-decision-is-a-question",
			"holds-by-default": "the-cost-sets-the-wait",
			"the-setting-decides": "the-cost-sets-the-wait",
			"a-hold-frees-the-slot": "the-cost-sets-the-wait",
			"never-timed-out": "what-was-agreed-is-never-cheap",
			"disagreement-opens-a-plan": "a-late-answer-opens-a-follow-on",
			"every-decision-stays": "a-late-answer-opens-a-follow-on",
			"release-refuses": "a-release-waits-for-a-known-wrong",
			"landing-never-waits": "a-release-waits-for-a-known-wrong",
		});
	});

	it("upheld: one span naming the promise, the clause and the outcome", async () => {
		const { tracer, spans } = capture();
		await reportClause("/nowhere", "holds-by-default", { outcome: "upheld" }, tracer);
		expect(spans).toHaveLength(1);
		expect(spans[0]?.attrs).toMatchObject({
			"indusk.promise": "the-cost-sets-the-wait",
			"indusk.clause": "holds-by-default",
			"indusk.promise.outcome": "upheld",
		});
		expect(spans[0]?.events).toEqual([]);
		expect(spans[0]?.ended).toBe(true);
	});

	it("broken: names what did not hold, and the plan and phase that added the signal", async () => {
		const { tracer, spans } = capture();
		await reportClause(
			"/nowhere",
			"disagreement-opens-a-plan",
			{ outcome: "broken", symptom: "q-1 answered late and differing, no follow-on opened" },
			tracer,
		);
		expect(spans[0]?.attrs["indusk.promise.outcome"]).toBe("broken");
		expect(spans[0]?.events[0]?.attrs).toMatchObject({
			"indusk.promise.symptom": "q-1 answered late and differing, no follow-on opened",
			"indusk.signal.plan": "decisions-as-questions",
			"indusk.signal.phase": "Build Phase 7",
		});
	});

	it("a tracer that throws never fails the one that reported", async () => {
		const tracer = {
			startSpan: () => {
				throw new Error("collector down");
			},
		} as unknown as Tracer;
		await expect(
			reportClause("/nowhere", "release-refuses", { outcome: "upheld" }, tracer),
		).resolves.toBeUndefined();
	});
});
