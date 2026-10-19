import { describe, expect, it } from "vitest";
import { markPromise } from "./mark.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/a-break-names-its-clause

/**
 * A16 of mark-first: when a clause's signal reports broken, the event it emits
 * carries the promise and the clause, and the plan and phase that added the
 * signal. An upheld signal carries no pointer: only a break needs one.
 */

function recordingSpan() {
	const attributes: Record<string, string> = {};
	const events: { name: string; attributes: Record<string, string> }[] = [];
	const span = {
		setAttribute(key: string, value: unknown) {
			attributes[key] = String(value);
			return span;
		},
		addEvent(name: string, attrs?: Record<string, unknown>) {
			events.push({
				name,
				attributes: Object.fromEntries(Object.entries(attrs ?? {}).map(([k, v]) => [k, String(v)])),
			});
			return span;
		},
	};
	return { span, attributes, events };
}

describe("A16 — a broken clause's event names the promise and the clause", () => {
	it("carries the promise, the clause and the symptom on the event", () => {
		const { span, events } = recordingSpan();
		markPromise(span, {
			promise: "a-clause-is-proved-twice",
			clause: "upheld-by-its-signal",
			outcome: "broken",
			symptom: "no report arrived",
			signal: { plan: "mark-first", phase: "Build Phase 2" },
		});
		const event = events.find((e) => e.name === "indusk.promise.violated");
		expect(event?.attributes["indusk.promise"]).toBe("a-clause-is-proved-twice");
		expect(event?.attributes["indusk.clause"]).toBe("upheld-by-its-signal");
		expect(event?.attributes["indusk.promise.symptom"]).toBe("no report arrived");
	});

	it("points to the plan and phase that added the signal, on the break only", () => {
		const broken = recordingSpan();
		markPromise(broken.span, {
			promise: "p",
			clause: "c",
			outcome: "broken",
			symptom: "s",
			signal: { plan: "mark-first", phase: "Build Phase 2" },
		});
		const event = broken.events.find((e) => e.name === "indusk.promise.violated");
		expect(event?.attributes["indusk.signal.plan"]).toBe("mark-first");
		expect(event?.attributes["indusk.signal.phase"]).toBe("Build Phase 2");

		const upheld = recordingSpan();
		markPromise(upheld.span, {
			promise: "p",
			clause: "c",
			outcome: "upheld",
			signal: { plan: "mark-first", phase: "Build Phase 2" },
		});
		expect(upheld.events).toEqual([]);
		expect(upheld.attributes["indusk.signal.plan"]).toBeUndefined();
	});
});
