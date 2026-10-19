// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report
import type { Tracer } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { type CapturedSpan, captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import { acceptBrief } from "./accept-brief.js";
import { bringTrunkIntoPlan } from "./bring-trunk.js";

/**
 * The seam for A47's second half: a git that swallows `merge --abort` leaves a conflicted
 * merge in the checkout, as a half-merge let through would. Off, it is the real git.
 */
const stub = vi.hoisted(() => ({ swallowAbort: false }));
vi.mock("../git.js", async (importActual) => {
	const actual = await importActual<typeof import("../git.js")>();
	return {
		...actual,
		git: (cwd: string, ...args: string[]) =>
			stub.swallowAbort && args[0] === "merge" && args[1] === "--abort"
				? Promise.resolve("")
				: actual.git(cwd, ...args),
	};
});

/**
 * a-run-can-be-trusted A46–A49: accepting a brief reports the three clauses of
 * a-brief-is-accepted-on-current-main from the code that keeps them.
 *
 * Each expectation reads the span the package's in-memory capture tracer kept: its own
 * `indusk.promise`, `indusk.clause` and `indusk.promise.outcome` attributes, the ones the
 * promise reader reads — never a mock of the writer. Real git in a temporary repository,
 * so this runs in the system tier.
 *
 * `acceptBrief(anyCheckout, plan, { tracer })` is the seam Build Phase 4 created: the reports
 * come from `bringTrunkIntoPlan`, so the admin's planning start (`build-host.trunk.test.ts`)
 * reads the same spans.
 */

const PLAN = "seat-holds";
const PROMISE = "a-brief-is-accepted-on-current-main";
const draft = (text: string) => text.replace("status: accepted", "status: draft");

let p: PlanLifecycleProject;
let wt: string;
let previous: string | undefined;
beforeEach(() => {
	stub.swallowAbort = false;
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	p = planLifecycleProject("accept-brief-signals");
	wt = p.makeWorktree(PLAN);
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	p.cleanup();
});

const writeBrief = () =>
	p.commit(wt, { [`.indusk/planning/${PLAN}/brief.md`]: draft(briefText(PLAN)) }, "the brief");
const mainMoves = (files: Record<string, string> = { "other.txt": "main moved\n" }) =>
	p.commit(p.trunk, files, "main moves");
const spanFor = (spans: CapturedSpan[], clause: string) =>
	spans.find((s) => s.attrs["indusk.clause"] === clause);

describe("accepting a brief reports its clauses", () => {
	it("A46: a branch behind main reports main-is-merged-first upheld, naming the promise", async () => {
		writeBrief();
		mainMoves();
		const { tracer, spans } = captureTracer();
		await acceptBrief(p.trunk, PLAN, { tracer });
		const span = spanFor(spans, "main-is-merged-first");
		expect(span, "a span for main-is-merged-first").toBeDefined();
		expect(span?.attrs["indusk.promise"]).toBe(PROMISE);
		expect(outcomesByClause(spans)["main-is-merged-first"]).toBe("upheld");
	});

	it("A47: a conflicting acceptance is refused with the brief a draft, and reports a-conflict-refuses upheld", async () => {
		p.commit(wt, { "README.md": "plan edit\n" }, "plan edits the readme");
		writeBrief();
		mainMoves({ "README.md": "main edit\n" });
		const { tracer, spans } = captureTracer();
		await expect(acceptBrief(p.trunk, PLAN, { tracer })).rejects.toThrow(/README\.md/);
		const span = spanFor(spans, "a-conflict-refuses");
		expect(span, "a span for a-conflict-refuses").toBeDefined();
		expect(span?.attrs["indusk.promise"]).toBe(PROMISE);
		expect(outcomesByClause(spans)["a-conflict-refuses"]).toBe("upheld");
	});

	it("A48: behind main with no conflict, nothing asked of the person, reports the-person-never-merges upheld", async () => {
		writeBrief();
		mainMoves();
		const { tracer, spans } = captureTracer();
		await acceptBrief(p.trunk, PLAN, { tracer });
		const span = spanFor(spans, "the-person-never-merges");
		expect(span, "a span for the-person-never-merges").toBeDefined();
		expect(span?.attrs["indusk.promise"]).toBe(PROMISE);
		expect(outcomesByClause(spans)["the-person-never-merges"]).toBe("upheld");
	});
});

describe("a clause that breaks is reported broken", () => {
	it("A47: a half-merge let through a conflicting acceptance reports a-conflict-refuses broken, naming what was left", async () => {
		p.commit(wt, { "README.md": "plan edit\n" }, "plan edits the readme");
		writeBrief();
		mainMoves({ "README.md": "main edit\n" });
		stub.swallowAbort = true;
		const { tracer, spans } = captureTracer();
		await expect(acceptBrief(p.trunk, PLAN, { tracer })).rejects.toThrow(/README\.md/);
		const span = spanFor(spans, "a-conflict-refuses");
		expect(span, "a span for a-conflict-refuses").toBeDefined();
		expect(outcomesByClause(spans)["a-conflict-refuses"]).toBe("broken");
		expect(JSON.stringify(span?.events)).toMatch(/merge is still in progress|unmerged files/);
	});

	it("A48: a refusal that tells the person to merge main reports the-person-never-merges broken", async () => {
		p.commit(wt, { "README.md": "plan edit\n" }, "plan edits the readme");
		writeBrief();
		mainMoves({ "README.md": "main edit\n" });
		const { tracer, spans } = captureTracer();
		await expect(
			bringTrunkIntoPlan(
				p.trunk,
				PLAN,
				{
					refused: "its brief was not accepted",
					again: "merge main into the branch by hand and accept the brief again",
					when: "its brief was accepted",
				},
				undefined,
				{ tracer },
			),
		).rejects.toThrow(/README\.md/);
		expect(outcomesByClause(spans)["the-person-never-merges"]).toBe("broken");
		expect(outcomesByClause(spans)["a-conflict-refuses"]).toBe("upheld");
	});
});

describe("a report that cannot be sent never fails the acceptance", () => {
	it("A49: a tracer that throws on startSpan leaves acceptBrief returning its result", async () => {
		writeBrief();
		mainMoves();
		const tracer = {
			startSpan: () => {
				throw new Error("no daemon");
			},
		} as unknown as Tracer;
		await expect(acceptBrief(p.trunk, PLAN, { tracer })).resolves.toEqual({ plan: PLAN });
	});
});

// promise: a-plan-with-clauses-carries-its-signals
