// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Tracer } from "@opentelemetry/api";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { type CapturedSpan, captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import { acceptBrief } from "./accept-brief.js";

/**
 * a-run-can-be-trusted A46–A49: accepting a brief reports the three clauses of
 * a-brief-is-accepted-on-current-main from the code that keeps them.
 *
 * Each expectation reads the span the package's in-memory capture tracer kept: its own
 * `indusk.promise`, `indusk.clause` and `indusk.promise.outcome` attributes, the ones the
 * promise reader reads — never a mock of the writer. Real git in a temporary repository,
 * so this runs in the system tier.
 *
 * Build Phase 4 gives `acceptBrief` the third argument these tests pass (`{ tracer }`).
 * Today it ignores it and reports nothing, so A46–A48 fail on their own assertion that a
 * span exists. The call is typed loosely for the same reason: the parameter is the seam
 * that phase creates.
 *
 * A47's second half (a stub that lets a half-merge through gives `broken`) needs the seam
 * Build Phase 4 adds to git in the same function, so it is written there.
 */

const PLAN = "seat-holds";
const PROMISE = "a-brief-is-accepted-on-current-main";
const draft = (text: string) => text.replace("status: accepted", "status: draft");

type Accept = (
	anyCheckout: string,
	plan: string,
	opts?: { tracer?: Tracer },
) => Promise<{ plan: string }>;
const accept = acceptBrief as unknown as Accept;

let p: PlanLifecycleProject;
let wt: string;
let previous: string | undefined;
beforeEach(() => {
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
		await accept(p.trunk, PLAN, { tracer });
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
		await expect(accept(p.trunk, PLAN, { tracer })).rejects.toThrow(/README\.md/);
		const span = spanFor(spans, "a-conflict-refuses");
		expect(span, "a span for a-conflict-refuses").toBeDefined();
		expect(span?.attrs["indusk.promise"]).toBe(PROMISE);
		expect(outcomesByClause(spans)["a-conflict-refuses"]).toBe("upheld");
	});

	it("A48: behind main with no conflict, nothing asked of the person, reports the-person-never-merges upheld", async () => {
		writeBrief();
		mainMoves();
		const { tracer, spans } = captureTracer();
		await accept(p.trunk, PLAN, { tracer });
		const span = spanFor(spans, "the-person-never-merges");
		expect(span, "a span for the-person-never-merges").toBeDefined();
		expect(span?.attrs["indusk.promise"]).toBe(PROMISE);
		expect(outcomesByClause(spans)["the-person-never-merges"]).toBe("upheld");
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
		await expect(accept(p.trunk, PLAN, { tracer })).resolves.toEqual({ plan: PLAN });
	});
});
