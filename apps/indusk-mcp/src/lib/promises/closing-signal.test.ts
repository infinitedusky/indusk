import type { Tracer } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { markClosing } from "./closing-signal.js";
import type { ClauseHalves, ConfirmResult } from "./confirm.js";

// promise: a-clause-is-proved-twice

/**
 * The signal a close writes for its own clauses (mark-first, decision D-18):
 * one span per half that judged a clause, upheld when the verdict followed
 * what it judged, broken only when the close accepted a refused clause. No
 * trajectory row: the plan's carried tracer work, recorded under Deferred
 * Verification; this pins the shape the live check (A11) reads.
 */

interface Captured {
	attrs: Record<string, unknown>;
	events: Array<{ name: string; attrs?: Record<string, unknown> }>;
}

function capture(): { tracer: Tracer; spans: Captured[] } {
	const spans: Captured[] = [];
	const tracer = {
		startSpan: () => {
			const s: Captured = { attrs: {}, events: [] };
			spans.push(s);
			return {
				setAttribute: (k: string, v: unknown) => {
					s.attrs[k] = v;
				},
				addEvent: (name: string, attrs?: Record<string, unknown>) => {
					s.events.push({ name, attrs });
				},
				end: () => {},
			};
		},
	} as unknown as Tracer;
	return { tracer, spans };
}

const half = (checked: string[], refused: string[] = []) => ({ refusals: [], checked, refused });
const halves = (tests = half(["p/a"]), signal = half(["p/a"])): ClauseHalves => ({ tests, signal });

describe("markClosing", () => {
	it("writes one upheld span per clause the close judged, naming the clause", async () => {
		const { tracer, spans } = capture();
		const result: ConfirmResult = { ok: false, refusals: [], written: false, halves: halves() };
		await markClosing("/nowhere", "p", result, tracer);
		expect(spans.map((s) => s.attrs["indusk.clause"])).toEqual([
			"verified-before-release",
			"upheld-by-its-signal",
		]);
		expect(spans.every((s) => s.attrs["indusk.promise.outcome"] === "upheld")).toBe(true);
	});

	it("is broken when the close accepted a clause a half refused", async () => {
		const { tracer, spans } = capture();
		const result: ConfirmResult = {
			ok: true,
			confirmed: [],
			halves: halves(half(["p/a"], ["p/a"])),
		};
		await markClosing("/nowhere", "p", result, tracer);
		expect(spans[0].attrs["indusk.promise.outcome"]).toBe("broken");
		expect(spans[1].attrs["indusk.promise.outcome"]).toBe("upheld");
	});

	it("writes nothing for a close that judged no clause", async () => {
		const { tracer, spans } = capture();
		await markClosing("/nowhere", "p", { ok: true, confirmed: [] }, tracer);
		expect(spans).toEqual([]);
	});
});
