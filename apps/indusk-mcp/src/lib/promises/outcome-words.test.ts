import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeJaegerFetch, type HeldSpan, jaegerSpan } from "../../__tests__/helpers/fake-jaeger.js";
import { type CapturedSpan, expectPromiseViolated } from "../testing/trace-shape.js";
import { healthLine } from "./health.js";
import { newestRuns } from "./health-line.js";
import { lookStandingFor } from "./look-standing.js";
import {
	jaegerEndpoint,
	type MarkedSpan,
	markedSpans,
	marksBetween,
	parseMarkedSpan,
} from "./telemetry.js";

// promise: a-promise-is-upheld-or-broken

/**
 * A1 and A2 of one-promise-language: one reading rule for the verdict a signal
 * carries. A1 is the new word (`broken`), red until the reader takes it; A2 is
 * the old word (`violated`), green today and the regression guard that keeps
 * already-instrumented applications working once the reader takes both.
 * Each reader of a signal is asked in turn: the status and health read
 * (`markedSpans`), the timeline's window query (`marksBetween`), the looks
 * standing, and the trace-shape helper.
 */

const PROMISE = "seats-held";
const SINCE = new Date(Date.now() - 3_600_000);
const NOW = () => new Date(Date.now() + 60_000);
const endpoint = jaegerEndpoint("http://jaeger.test");

const heldSpan = (word: string, spanId: string, extra: Record<string, string> = {}): HeldSpan => ({
	service: "seat-holds",
	name: "release-seat",
	spanId,
	tags: { "indusk.promise": PROMISE, "indusk.promise.outcome": word, ...extra },
});

afterEach(() => vi.unstubAllGlobals());

/**
 * What the in-memory outcome may be once a signal is read. A1 pins the new
 * spelling exactly; A2 pins only that the old word still reads as a break,
 * whichever spelling the reader keeps in memory — what keeps it green today
 * and after the reader takes both words.
 */
const WORDS = [
	{ id: "A1", word: "broken", reads: ["broken"] },
	{ id: "A2", word: "violated", reads: ["broken", "violated"] },
] as const;

for (const { id, word, reads } of WORDS) {
	describe(`${id} — a signal saying ${word} is read as broken`, () => {
		it("the span parser returns it as a broken signal", () => {
			const { span } = jaegerSpan(heldSpan(word, "s1"));
			const parsed = parseMarkedSpan(span, "seat-holds");
			expect(parsed).not.toBeNull();
			expect(reads).toContain((parsed as MarkedSpan).outcome);
		});

		it("status and health count it among the promise's breaks", async () => {
			vi.stubGlobal("fetch", fakeJaegerFetch([heldSpan(word, "s1")]));
			const read = await markedSpans({ promises: [PROMISE], since: SINCE, endpoint });
			const marks = read.byPromise.get(PROMISE);
			expect(marks?.violations.map((m) => m.spanId)).toEqual(["s1"]);
		});

		it("the timeline's window query returns it as a broken mark", async () => {
			vi.stubGlobal("fetch", fakeJaegerFetch([heldSpan(word, "s1")]));
			const { marks } = await marksBetween(endpoint, {
				service: "seat-holds",
				name: PROMISE,
				promise: PROMISE,
				from: SINCE,
				to: NOW(),
				timeoutMs: 1_000,
			});
			expect(marks.map((m) => m.spanId)).toEqual(["s1"]);
			expect(reads).toContain(marks[0]?.outcome);
		});

		it("a look's newest run saying it makes the look's standing broken", () => {
			const { span } = jaegerSpan(
				heldSpan(word, "s1", {
					"indusk.look.app": "seats",
					"indusk.look.screen": "board",
					"indusk.look.state": "default",
					"indusk.look.device": "phone",
				}),
			);
			const parsed = parseMarkedSpan(span, "seat-holds");
			expect(parsed).not.toBeNull();
			const m = parsed as MarkedSpan;
			const run = {
				...(m.look as NonNullable<MarkedSpan["look"]>),
				outcome: m.outcome,
				at: m.at.toISOString(),
				symptom: m.symptom,
			};
			expect(lookStandingFor(true, run as Parameters<typeof lookStandingFor>[1])).toBe("broken");
		});

		it("the trace-shape helper accepts a captured span carrying it as the promise broken", () => {
			const captured: CapturedSpan = {
				name: "release-seat",
				spanId: "s1",
				parentSpanId: "",
				parentName: null,
				attributes: { "indusk.promise": PROMISE, "indusk.promise.outcome": word },
				events: [
					{ name: "indusk.promise.violated", attributes: { "indusk.promise.symptom": "x" } },
				],
			};
			expect(() => expectPromiseViolated([captured], `promise: ${PROMISE}`)).not.toThrow();
		});
	});
}

/**
 * A14 of one-promise-language (Build Phase 4): `indusk promises health --json`
 * is a wire an editor installed before this plan reads with
 * `r.outcome === "violated" ? "broke" : "held"`. Its runs keep the old word
 * for a break this release, whichever way the signal was written.
 */
describe("A14 — the editor's input keeps saying violated for a break", () => {
	it("a run from a signal saying broken and one saying violated both read broke by the old editor rule", () => {
		const runs = newestRuns(
			new Map([
				[
					PROMISE,
					[
						{ at: "2026-10-15T12:00:02.000Z", outcome: "broken", traceId: "t-b" },
						{ at: "2026-10-15T12:00:01.000Z", outcome: "violated", traceId: "t-v" },
						{ at: "2026-10-15T12:00:00.000Z", outcome: "upheld", traceId: "t-u" },
					],
				],
			]),
		);
		const read = { name: "local", label: "local", ok: true, at: "x", marks: {}, runs } as never;
		const line = healthLine({ promises: [], incidents: [] } as never, [read], new Date());
		const oldEditor = (r: { outcome: string }) => (r.outcome === "violated" ? "broke" : "held");
		expect(line.runs.map((r) => oldEditor(r))).toEqual(["broke", "broke", "held"]);
	});
});

/**
 * A18: the trace-shape helper's failure messages say broken in prose; the event
 * name `indusk.promise.violated` is wire vocabulary and stays.
 */
describe("A18 — the trace-shape helper's failure messages say broken", () => {
	const noBreak: CapturedSpan = {
		name: "release-seat",
		spanId: "s1",
		parentSpanId: "",
		parentName: null,
		attributes: { "indusk.promise": PROMISE, "indusk.promise.outcome": "upheld" },
		events: [],
	};
	const withoutEvent: CapturedSpan = {
		...noBreak,
		attributes: { "indusk.promise": PROMISE, "indusk.promise.outcome": "broken" },
	};
	const prose = (m: string) =>
		m.replace(/indusk\.promise\.violated/g, "").replace(/expectPromiseViolated/g, "");

	it("no span signalled a break", () => {
		let message = "";
		try {
			expectPromiseViolated([noBreak], `promise: ${PROMISE}`);
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).not.toBe("");
		expect(prose(message)).not.toMatch(/\bviolated\b/i);
		expect(message).toMatch(/broken/);
	});

	it("a broken span carries no event", () => {
		let message = "";
		try {
			expectPromiseViolated([withoutEvent], `promise: ${PROMISE}`);
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).not.toBe("");
		expect(prose(message)).not.toMatch(/\bviolated\b/i);
		expect(message).toMatch(/broken/);
	});
});
