import { afterEach, describe, expect, it } from "vitest";
import { markPromise } from "./mark.js";
import { type JaegerSpan, parseMarkedSpan } from "./telemetry.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/upheld-by-its-signal

/**
 * A6 of mark-first: a span a test run produced is not the clause's signal. A
 * writer marks a span made under a test runner `indusk.run=test`, and the
 * reader ignores it, so a clause reads no signal however often its test passes.
 */

const span = (tags: { key: string; value: unknown }[]): JaegerSpan => ({
	traceID: "t",
	spanID: "s",
	operationName: "op",
	startTime: 1_000_000,
	duration: 1_000,
	processID: "p",
	tags,
});

const signalTags = [
	{ key: "indusk.promise", value: "a-promise" },
	{ key: "indusk.promise.outcome", value: "upheld" },
];

describe("A6 — a test run's span is not a signal", () => {
	it("the reader ignores a span carrying indusk.run=test", () => {
		expect(
			parseMarkedSpan(span([...signalTags, { key: "indusk.run", value: "test" }]), "svc"),
		).toBe(null);
	});

	it("the reader still reads the same span without the marker", () => {
		expect(parseMarkedSpan(span(signalTags), "svc")?.promise).toBe("a-promise");
	});

	// A35 (Build Phase 7, falsification): the scaffold documents `indusk.run`
	// as a resource attribute, so a run marked through OTEL_RESOURCE_ATTRIBUTES
	// carries it only in Jaeger's process tags.
	it("A35 — the reader ignores a span whose resource carries indusk.run=test", () => {
		expect(
			parseMarkedSpan(span(signalTags), "svc", [{ key: "indusk.run", value: "test" }]),
		).toBe(null);
	});

	describe("the writer marks a span made under a test runner", () => {
		const before = process.env.VITEST;
		afterEach(() => {
			if (before === undefined) delete process.env.VITEST;
			else process.env.VITEST = before;
		});

		function written(): Record<string, string> {
			const attributes: Record<string, string> = {};
			const s = {
				setAttribute(k: string, v: unknown) {
					attributes[k] = String(v);
					return s;
				},
				addEvent() {
					return s;
				},
			};
			markPromise(s, { promise: "a-promise", outcome: "upheld" });
			return attributes;
		}

		it("under a test runner it writes indusk.run=test", () => {
			process.env.VITEST = "true";
			expect(written()["indusk.run"]).toBe("test");
		});

		it("outside a test runner it writes no run marker", () => {
			delete process.env.VITEST;
			expect(written()["indusk.run"]).toBeUndefined();
		});
	});
});
