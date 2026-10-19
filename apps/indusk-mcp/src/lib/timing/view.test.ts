// promise: a-plan-says-how-long-it-took
// clause: a-plan-says-how-long-it-took/one-view
// clause: a-plan-says-how-long-it-took/steps-are-timed
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { PlanCommandRefusal } from "../plans/plan-branch.js";
import type { PhaseBoundaryRecord } from "../shape/boundary-record.js";
import type { TimingRecord } from "./log.js";
import {
	formatDuration,
	formatPlanTime,
	landingTime,
	type PlanTimeReads,
	planTime,
	planTimeText,
} from "./view.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
	const d = mkdtempSync(join(tmpdir(), "timing-view-"));
	dirs.push(d);
	return d;
};

const P = "p";
const iso = (min: number) =>
	new Date(Date.parse("2026-06-01T08:00:00.000Z") + min * 60_000).toISOString();
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
	expect(result.steps).toMatchObject([
		{ step: "work", durationMs: 6 * 60_000, outcome: "finished" },
	]);
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
	expect(by["Build Phase 1"]).toMatchObject({
		durationMs: 20 * 60_000,
		derived: false,
		open: false,
	});
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
	expect(result.missing).toEqual(expect.arrayContaining(["steps", "test runs", "acceptance time"]));
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

it("A20 an open last phase of a landed plan ends at the landing, so a week later its time has not grown", async () => {
	const read = (nowMin: number) =>
		planTime("/r", P, {
			now: () => ms(nowMin),
			reads: reads({
				boundaries: async () => [opening(1, 10, "build"), opening(2, 30, "build")],
				landedAt: async () => iso(90),
			}),
		});
	const soon = await read(100);
	const later = await read(100 + 7 * 24 * 60);
	const last = later.phases.find((p) => p.label === "Build Phase 2");
	expect(last).toMatchObject({ durationMs: 60 * 60_000, open: false, derived: true });
	expect(later.phases.map((p) => p.durationMs)).toEqual(soon.phases.map((p) => p.durationMs));
	// total 90 min, phases 20 + 60 min: between is the signed remainder, not clamped
	expect(later.between).toBe(10 * 60_000);
});

it("A20 between is printed signed when the phases outrun the total", async () => {
	const result = await planTime("/r", P, {
		now: () => ms(200),
		reads: reads({
			boundaries: async () => [opening(1, 0, "build")],
			timings: async () => [close(1, 90)],
			landedAt: async () => iso(60),
		}),
	});
	expect(result.between).toBe(-30 * 60_000);
	expect(formatPlanTime(result)).toMatch(/between\s+-30m 00s/);
});

it("A22 a workbench plan's landing is searched in the code repo's trunk, not the workbench root", async () => {
	const searched: string[] = [];
	const landed = await landingTime("/workbench", "p", {
		codeRootOf: () => "/code-repo",
		trunkOf: (root) => root,
		runGit: async (cwd) => {
			searched.push(cwd);
			return cwd === "/code-repo" ? "2026-06-01T10:00:00+00:00" : "";
		},
	});
	expect(searched).toEqual(["/code-repo"]);
	expect(landed).toBe("2026-06-01T10:00:00+00:00");
});

it("A22 a refused code root falls back to the plan root", async () => {
	const searched: string[] = [];
	await landingTime("/root", "p", {
		codeRootOf: () => null,
		trunkOf: (root) => root,
		runGit: async (cwd) => {
			searched.push(cwd);
			return "";
		},
	});
	expect(searched).toEqual(["/root"]);
});

it("A23 run from the trunk, the phase openings are read from the plan's worktree", async () => {
	const trunk = tmp();
	const worktree = tmp();
	mkdirSync(join(worktree, ".indusk"), { recursive: true });
	writeFileSync(
		join(worktree, ".indusk", "phase-boundary.jsonl"),
		`${JSON.stringify({ plan: P, phase: 1, kind: "build", sha: "s", timestamp: iso(5) })}\n`,
	);
	const result = await planTime(trunk, P, {
		now: () => ms(30),
		liveRoot: worktree,
		home: tmp(),
	});
	expect(result.phases.map((p) => p.label)).toEqual(["Build Phase 1"]);
	expect(result.missing).not.toContain("phase openings");
});

it("A24 a name that is no plan is refused, not printed as an empty view", async () => {
	await expect(
		planTimeText(tmp(), "no-such-plan", { liveRoot: async () => null }),
	).rejects.toBeInstanceOf(PlanCommandRefusal);
});

it("A24 a plan folder with no records still prints what exists", async () => {
	const root = tmp();
	mkdirSync(join(root, ".indusk", "planning", "old-plan"), { recursive: true });
	const text = await planTimeText(root, "old-plan", { liveRoot: async () => root, home: tmp() });
	expect(text).toMatch(/no record of:/);
});
