import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeJaegerFetch, type HeldSpan } from "../../__tests__/helpers/fake-jaeger.js";
import { jaegerEndpoint } from "../promises/telemetry.js";
import { slackText, violationsSince } from "./pass.js";

// promise: a-production-break-is-recorded-unasked
// promise: a-promise-is-upheld-or-broken

/**
 * A12 of one-promise-language: the always-on server announces a production
 * signal saying `broken` exactly as one saying `violated`. The server asks its
 * Jaeger for signals by the outcome word, so the fake answers each query only
 * with the spans whose word matches the tag asked for, as a real Jaeger does;
 * it holds one signal of each word.
 */

afterEach(() => vi.unstubAllGlobals());

const held = (spanId: string, word: string): HeldSpan => ({
	service: "seat-holds",
	name: "release",
	spanId,
	tags: {
		"indusk.promise": "seat-released",
		"indusk.promise.outcome": word,
		"deployment.environment": "production",
	},
});

describe("A12 — the server announces a signal saying broken as it does one saying violated", () => {
	it("a pass over one of each word returns both", async () => {
		vi.stubGlobal("fetch", fakeJaegerFetch([held("b1", "broken"), held("v1", "violated")]));
		const found = await violationsSince(
			jaegerEndpoint("http://jaeger.test"),
			new Date(Date.now() - 3_600_000),
		);
		expect(found.map((s) => s.spanId).sort()).toEqual(["b1", "v1"]);
	});

	it("announces both with the same words", async () => {
		vi.stubGlobal("fetch", fakeJaegerFetch([held("b1", "broken"), held("v1", "violated")]));
		const found = await violationsSince(
			jaegerEndpoint("http://jaeger.test"),
			new Date(Date.now() - 3_600_000),
		);
		const text = (id: string) => {
			const span = found.find((s) => s.spanId === id);
			expect(span, `the ${id} signal was found`).toBeDefined();
			return slackText(span as NonNullable<typeof span>, null).replace(/trace t-\w+/, "trace <id>");
		};
		expect(text("b1")).toBe(text("v1"));
	});
});
