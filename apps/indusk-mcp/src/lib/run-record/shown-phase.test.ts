// clause: a-run-is-read-from-its-record/shows-where-it-is
import { describe, expect, it } from "vitest";
import type { ImplPhase } from "../impl-parser-core.js";
import { PROCESS_GONE } from "./liveness.js";
import { shownPhase } from "./shown-phase.js";
import { stopSentence } from "./stop-sentence.js";

/**
 * A14–A17 (a-run-can-be-trusted, Build Phase 2): the phase the build controls name
 * is read from the plan each time, never from the phase the run started at.
 */

const phase = (kind: "test" | "build", number: number, open: boolean): ImplPhase =>
	({
		kind,
		number,
		ordinal: number,
		name: `phase ${number}`,
		gates: [{ type: "implementation", items: [{ checked: !open, text: "an item" }] }],
	}) as unknown as ImplPhase;

const planWith = (
	closed: Array<["test" | "build", number]>,
	open: Array<["test" | "build", number]>,
) => ({
	impl: {
		phases: [
			...closed.map(([k, n]) => phase(k, n, false)),
			...open.map(([k, n]) => phase(k, n, true)),
		],
	},
});

describe("A14 — the phase shown is the plan's, not the run's start", () => {
	it("A14 a build started at Test Phase 1 that has closed three phases shows the fourth", () => {
		const plan = planWith(
			[
				["test", 1],
				["build", 1],
				["build", 2],
				["build", 3],
			],
			[["build", 4]],
		);
		expect(shownPhase(plan, { startedAtPhase: "Test Phase 1" })).toBe("Build Phase 4: phase 4");
	});
});

describe("A15 — a plan that moves between two loads shows the new phase", () => {
	it("A15 the second load names the new phase with no run-state change", () => {
		const first = planWith([["build", 1]], [["build", 2]]);
		const second = planWith(
			[
				["build", 1],
				["build", 2],
			],
			[["build", 3]],
		);
		const run = { startedAtPhase: "Build Phase 1: phase 1" };
		expect(shownPhase(first, run)).toBe("Build Phase 2: phase 2");
		expect(shownPhase(second, run)).toBe("Build Phase 3: phase 3");
	});
});

describe("A16 — a plan whose phase cannot be read names none", () => {
	it("A16 an unreadable plan, no impl and no open phase read null, never the run's phase", () => {
		const run = { startedAtPhase: "Test Phase 1: stale" };
		expect(shownPhase(null, run)).toBeNull();
		expect(shownPhase(undefined, run)).toBeNull();
		expect(shownPhase({ impl: { phases: [] } }, run)).toBeNull();
		expect(shownPhase(planWith([["build", 1]], []), run)).toBeNull();
	});
});

describe("A17 — the stop sentence keeps the plan's real phase", () => {
	const plan = planWith([["build", 1]], [["build", 2]]);
	const phase = shownPhase(plan, { startedAtPhase: "Test Phase 1: stale" });

	it("A17 a waiting amendment, a blocker and a dead run each name the plan's phase", () => {
		for (const stop of [
			{ step: "amendment", amendments: ["promise a"] },
			{ step: "cannot-continue", why: "the last step's session failed: rate limit" },
			{ step: "cannot-continue", why: PROCESS_GONE },
		] as const) {
			const sentence = stopSentence(stop, phase);
			expect(sentence).toContain("Build Phase 2: phase 2");
			expect(sentence).not.toContain("Test Phase 1");
		}
	});

	it("A17 a dead run says it died and that Build starts it again", () => {
		expect(stopSentence({ step: "cannot-continue", why: PROCESS_GONE }, phase)).toMatch(
			/died[\s\S]*Build starts it again/,
		);
	});

	it("A17 a plan with no readable phase is named no phase", () => {
		expect(stopSentence({ step: "cannot-continue", why: PROCESS_GONE }, null)).not.toMatch(/ at /);
	});
});
