// clause: a-run-is-read-from-its-record/shows-where-it-is
// clause: a-run-is-read-from-its-record/released-only-when-landed
// clause: a-run-is-read-from-its-record/says-what-is-true
// clause: a-run-is-read-from-its-record/always-a-next-step
// clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step
import { describe, expect, it } from "vitest";
import type { PsRow } from "../process-identity.js";
import { captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import {
	judgeNextStep,
	judgePlanningAudit,
	judgeReleased,
	judgeSaysWhatIsTrue,
	judgeShowsWhereItIs,
	reportShowsWhereItIs,
	type TrueInput,
} from "./situation-signals.js";

const AT = "2026-10-19T10:00:00.000Z";
const row = (pid: number): PsRow => ({ pid, startedAt: AT, command: "claude" });

describe("shows-where-it-is", () => {
	it("is upheld when the phase shown is the phase the live session works, broken naming both when not", () => {
		const same = { plan: "p", shown: "Build Phase 2: x", sessionPhase: "Build Phase 2: x" };
		expect(judgeShowsWhereItIs(same)).toEqual({
			promise: "a-run-is-read-from-its-record",
			clause: "shows-where-it-is",
		});
		const off = judgeShowsWhereItIs({ ...same, shown: "Test Phase 1: y" });
		expect(off?.broken).toMatch(
			/p shows Test Phase 1: y but its live session works Build Phase 2: x/,
		);
	});

	it("reports nothing while no build runs", async () => {
		expect(judgeShowsWhereItIs({ plan: "p", shown: null, sessionPhase: null })).toBeNull();
		const { tracer, spans } = captureTracer();
		await reportShowsWhereItIs("/p", { plan: "p", shown: "a", sessionPhase: "a" }, tracer);
		expect(outcomesByClause(spans)).toEqual({ "shows-where-it-is": "upheld" });
	});
});

describe("released-only-when-landed", () => {
	it("is broken, naming the plan, when the trunk's log has no landing for it", () => {
		expect(judgeReleased("p", ["Merge plan/p: p landed"]).broken).toBeUndefined();
		expect(judgeReleased("p", ["Merge plan/q: q landed"]).broken).toMatch(/p was marked released/);
		expect(judgeReleased("foo", ["Merge plan/bar-foo: bar-foo landed"]).broken).toBeDefined();
	});
});

describe("says-what-is-true", () => {
	const base: TrueInput = {
		plan: "p",
		kind: "building",
		text: "Building — Build Phase 1: x",
		heldHere: false,
		sessions: [{ pid: 7, startedAt: AT, kind: "build" }],
		table: [row(7)],
		subjects: [],
	};

	it("building needs a live process matching a held build session, or this daemon's own run", () => {
		expect(judgeSaysWhatIsTrue(base)?.broken).toBeUndefined();
		expect(judgeSaysWhatIsTrue({ ...base, table: [] })?.broken).toMatch(
			/Building — Build Phase 1: x.*no process runs/,
		);
		expect(judgeSaysWhatIsTrue({ ...base, table: [], heldHere: true })?.broken).toBeUndefined();
		// a planning session is not a build's process
		expect(
			judgeSaysWhatIsTrue({ ...base, sessions: [{ pid: 7, startedAt: AT, kind: "planning" }] })
				?.broken,
		).toBeDefined();
	});

	it("complete needs the landing in the trunk's log", () => {
		const complete = { ...base, kind: "complete" as const, text: "Complete — merged to main" };
		expect(
			judgeSaysWhatIsTrue({ ...complete, subjects: ["Merge plan/p: p landed"] })?.broken,
		).toBeUndefined();
		expect(judgeSaysWhatIsTrue(complete)?.broken).toMatch(/landing is not in the trunk's log/);
	});

	it("stopped needs neither a live process nor a landing", () => {
		const stopped = {
			...base,
			kind: "stopped" as const,
			text: "Stopped — x",
			sessions: [],
			table: [],
		};
		expect(judgeSaysWhatIsTrue(stopped)?.broken).toBeUndefined();
		expect(judgeSaysWhatIsTrue({ ...stopped, heldHere: true })?.broken).toMatch(/a process runs/);
		expect(
			judgeSaysWhatIsTrue({ ...stopped, subjects: ["Merge plan/p: p landed"] })?.broken,
		).toMatch(/landing is in/);
	});

	it("a plan waiting or idle claims nothing to check", () => {
		expect(judgeSaysWhatIsTrue({ ...base, kind: "waiting" })).toBeNull();
		expect(judgeSaysWhatIsTrue({ ...base, kind: "idle" })).toBeNull();
	});
});

describe("always-a-next-step", () => {
	it("is broken, naming the plan, for an open plan with no next step; a closed plan is not judged", () => {
		expect(
			judgeNextStep({ plan: "p", kind: "idle", next: { text: "start it", by: "person" } })?.broken,
		).toBeUndefined();
		expect(judgeNextStep({ plan: "p", kind: "idle", next: null })?.broken).toMatch(
			/p is open and shows no next step/,
		);
		expect(judgeNextStep({ plan: "p", kind: "closed", next: null })).toBeNull();
	});
});

describe("the-planning-audit-is-a-step", () => {
	it("is upheld when the step state matches what plan-review.md says on disk", () => {
		// no file and a draft impl: the audit is open, so a step reading "not-yet" is true
		expect(
			judgePlanningAudit({ plan: "p", shown: "not-yet", implStatus: "draft", reviewText: null })
				?.broken,
		).toBeUndefined();
		// an approved impl has done its audit
		expect(
			judgePlanningAudit({ plan: "p", shown: "done", implStatus: "approved", reviewText: null })
				?.broken,
		).toBeUndefined();
	});

	it("is broken, naming the plan and the state shown, when they differ or the step is missing", () => {
		expect(
			judgePlanningAudit({ plan: "p", shown: "done", implStatus: "draft", reviewText: null })
				?.broken,
		).toMatch(/p shows the Planning audit done but plan-review.md on disk says open/);
		expect(
			judgePlanningAudit({ plan: "p", shown: null, implStatus: "draft", reviewText: null })?.broken,
		).toMatch(/shows no Planning audit step/);
		expect(
			judgePlanningAudit({ plan: "p", shown: null, implStatus: null, reviewText: null }),
		).toBeNull();
	});
});
