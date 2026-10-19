// clause: a-plan-says-how-long-it-took/one-view
// clause: a-plan-says-how-long-it-took/steps-are-timed
import { expect, it } from "vitest";
import type { PhaseBoundaryRecord } from "../shape/boundary-record.js";
import type { TimingRecord } from "./log.js";
import { formatPlanTime, formatDuration, type PlanTimeReads, planTime } from "./view.js";

const P = "p";
const iso = (min: number) => new Date(Date.parse("2026-06-01T08:00:00.000Z") + min * 60_000).toISOString();
const ms = (min: number) => Date.parse(iso(min));

const opening = (phase: number, min: number, kind?: "test" | "build"): PhaseBoundaryRecord => ({
	plan: P,
	phase,
	...(kind ? { kind } : {}),
	sha: "s",
	timestamp: iso(min),
});
const close = (phase: number, min: number): TimingRecord => ({
	v: 1,
	kind: "phase-close",
	plan: P,
	at: iso(min),
	phase,
	sha: "s",
});
const stepStart = (id: string, step: string, min: number, phase?: string): TimingRecord => ({
	v: 1,
	kind: "step-start",
	plan: P,
	at: iso(min),
	id,
	step,
	...(phase ? { phase } : {}),
});
const stepEnd = (
	id: string,
	step: string,
	min: number,
	outcome: "finished" | "blocked" | "failed" | "stopped",
): TimingRecord => ({ v: 1, kind: "step-end", plan: P, at: iso(min), id, step, outcome });
const testRun = (min: number, durationMs: number, passed: boolean): TimingRecord => ({
	v: 1,
	kind: "test-run",
	plan: P,
	at: iso(min),
	scope: { phase: "Build Phase 1" },
	files: { own: 2, reached: 0, mustNotBreak: 1 },
	startedAt: iso(min - 1),
	durationMs,
	passed,
});

const reads = (over: Partial<PlanTimeReads> = {}): PlanTimeReads => ({
	boundaries: async () => [],
	timings: async () => [],
	acceptedAt: async () => iso(0),
	landedAt: async () => null,
	...over,
});

it("A10 lists phases, steps and test runs in the order they happened, each with a duration", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(100),
		reads: reads({
			boundaries: async () => [opening(1, 20, "build"), opening(1, 10, "test")],
			timings: async () => [
				testRun(40, 45_000, true),
				close(1, 35), // no phaseKind: the build phase 1
				stepStart("a", "work", 12, "Build Phase 1"),
				stepEnd("a", "work", 18, "finished"),
			],
		}),
	});
	expect(result.phases.map((p) => p.label)).toEqual(["Test Phase 1", "Build Phase 1"]);
	expect(result.steps).toMatchObject([{ step: "work", durationMs: 6 * 60_000, outcome: "finished" }]);
	expect(result.testRuns).toMatchObject([{ durationMs: 45_000, passed: true }]);
});

it("A10 a phase ends at its recorded close, else when the next phase opened, else it is open", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(100),
		reads: reads({
			boundaries: async () => [
				opening(1, 0, "test"),
				opening(1, 30, "build"),
				opening(2, 60, "build"),
			],
			timings: async () => [close(1, 50)],
		}),
	});
	const by = Object.fromEntries(result.phases.map((p) => [p.label, p]));
	expect(by["Test Phase 1"]).toMatchObject({ durationMs: 30 * 60_000, derived: true, open: false });
	// Build Phase 1 has a recorded close at minute 50
	expect(by["Build Phase 1"]).toMatchObject({ durationMs: 20 * 60_000, derived: false, open: false });
	expect(by["Build Phase 2"]).toMatchObject({ durationMs: 40 * 60_000, open: true });
});

it("A6 a step with a start and no end reads as started and never ended, with the time since", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(90),
		reads: reads({ timings: async () => [stepStart("a", "falsify", 30)] }),
	});
	expect(result.steps).toMatchObject([
		{ step: "falsify", ended: false, outcome: null, durationMs: null, sinceStartMs: 60 * 60_000 },
	]);
	expect(formatPlanTime(result)).toMatch(/started, never ended/);
});

it("A11 the total runs from acceptance to landing; the difference to the phases is shown as between", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(500),
		reads: reads({
			boundaries: async () => [opening(1, 10, "build")],
			timings: async () => [close(1, 70)],
			landedAt: async () => iso(120),
		}),
	});
	expect(result.total).toMatchObject({ landed: true, ms: 120 * 60_000 });
	expect(result.between).toBe(60 * 60_000);
	expect(formatPlanTime(result)).toMatch(/total\s+2h 00m/);
});

it("A11 a plan not yet landed says so and shows the time so far", async () => {
	const result = await planTime("/r", P, { now: () => ms(75), reads: reads() });
	expect(result.total).toMatchObject({ landed: false, ms: 75 * 60_000 });
	expect(formatPlanTime(result)).toMatch(/total\s+1h 15m \(so far, not yet landed\)/);
});

it("A12 a plan recorded before this change prints what exists, names what has no record and does not fail", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(30),
		reads: reads({
			boundaries: async () => [opening(1, 5, "build")],
			acceptedAt: async () => null,
		}),
	});
	expect(result.phases).toHaveLength(1);
	expect(result.missing).toEqual(
		expect.arrayContaining(["steps", "test runs", "acceptance time"]),
	);
	const text = formatPlanTime(result);
	expect(text).toMatch(/no record of: .*steps.*test runs/);
	expect(text).toMatch(/Build Phase 1/);
});

it("A12 an unreadable phase-boundary record is reported, not thrown", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(30),
		reads: reads({
			boundaries: async () => {
				throw new Error("Corrupt phase-boundary record");
			},
			timings: async () => [stepStart("a", "work", 1), stepEnd("a", "work", 2, "failed")],
		}),
	});
	expect(result.phases).toEqual([]);
	expect(result.missing.join()).toMatch(/phase openings \(unreadable/);
	expect(result.steps).toHaveLength(1);
});

it("A19 a duration across a daylight-saving change is the elapsed instants, whatever the zone", async () => {
	// 2026-03-08 02:00 US Eastern springs forward: 01:30 -05:00 to 03:30 -04:00 is one hour.
	const result = await planTime("/r", P, {
		now: () => Date.parse("2026-03-08T09:00:00.000Z"),
		reads: reads({
			boundaries: async () => [
				{ plan: P, phase: 1, kind: "build", sha: "s", timestamp: "2026-03-08T01:30:00-05:00" },
			],
			timings: async () => [
				{ v: 1, kind: "phase-close", plan: P, at: "2026-03-08T03:30:00-04:00", phase: 1, sha: "s" },
			],
			acceptedAt: async () => "2026-03-08T01:00:00-05:00",
		}),
	});
	expect(result.phases[0].durationMs).toBe(60 * 60_000);
	expect(result.phases[0].durationMs).toBe(
		Date.parse("2026-03-08T07:30:00.000Z") - Date.parse("2026-03-08T06:30:00.000Z"),
	);
});

it("durations print like 1h 04m, 4m 12s and 9s", () => {
	expect(formatDuration(64 * 60_000)).toBe("1h 04m");
	expect(formatDuration(252_000)).toBe("4m 12s");
	expect(formatDuration(9_000)).toBe("9s");
});
