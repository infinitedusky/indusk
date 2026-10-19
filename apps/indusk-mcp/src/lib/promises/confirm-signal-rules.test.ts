// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals
// clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause
// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report
import { rmSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CLAUSES,
	clausePlanProject,
	PLAN,
	PROMISE,
	passingRun,
	testOf,
	upheldSignals,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { promisesContract } from "../../bin/commands/promises.js";
import { captureTracer, outcomesByClause } from "./capture-tracer.js";
import { confirmPlan, reportSignalRules, signalRuleVerdicts } from "./confirm.js";

/**
 * The commands' one tracer, stood in for by the package's capture tracer, so a span the
 * contract command sends without being handed a tracer is read here; and the impl it is
 * handed on stdin (`--impl-stdin`), as the save check hands it.
 */
const commands = vi.hoisted(() => ({
	spans: [] as import("./capture-tracer.js").CapturedSpan[],
	tracer: null as import("@opentelemetry/api").Tracer | null,
	stdin: "",
}));
vi.mock("../telemetry/command-tracer.js", async () => {
	const { captureTracer: make } = await import("./capture-tracer.js");
	const made = make();
	commands.spans = made.spans;
	commands.tracer = made.tracer;
	return { commandTracer: () => made.tracer, flushCommandTracer: async () => {} };
});
vi.mock("node:stream/consumers", async (importOriginal) => ({
	...(await importOriginal<typeof import("node:stream/consumers")>()),
	text: async () => commands.stdin,
}));

/**
 * a-run-can-be-trusted A84: confirming a plan written as clauses reports
 * `refused-without-signals` broken for each split or limit clause still without a report,
 * naming it, and upheld for each that has one. The close's reads are handed in; the spans
 * are read through the package's in-memory capture tracer.
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const close = (p: PromiseProject, readSignals: ReturnType<typeof upheldSignals>) =>
	confirmPlan({
		planRoot: p.planRoot,
		codeRoot: p.codeRoot,
		plan: PLAN,
		runTests: passingRun(),
		readSignals,
	});

describe("A84 — a close reports the rule that let an unreported clause through", () => {
	it("a clause still at no signal is reported broken, naming the plan and the clause", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, upheldSignals("b-clause"));
		const { tracer, spans } = captureTracer();
		await reportSignalRules(fixture.planRoot, PLAN, result, tracer);
		const broken = spans.filter(
			(s) =>
				s.attrs["indusk.clause"] === "refused-without-signals" &&
				s.attrs["indusk.promise.outcome"] === "broken",
		);
		expect(broken).toHaveLength(1);
		const said = JSON.stringify(broken[0]);
		expect(said).toContain("a-promise/b-clause");
		expect(said).toContain(`${PLAN}:`);
		const upheld = spans.filter(
			(s) =>
				s.attrs["indusk.clause"] === "refused-without-signals" &&
				s.attrs["indusk.promise.outcome"] === "upheld",
		);
		expect(upheld).toHaveLength(1);
		expect(JSON.stringify(upheld[0])).not.toContain("b-clause");
		expect(
			spans.every((s) => s.attrs["indusk.promise"] === "a-plan-with-clauses-carries-its-signals"),
		).toBe(true);
	});

	it("every clause having reported, each is upheld and none broken", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, upheldSignals());
		const verdicts = signalRuleVerdicts(PLAN, result, null);
		expect(verdicts.filter((v) => v.clause === "refused-without-signals")).toHaveLength(2);
		expect(verdicts.some((v) => v.broken !== undefined)).toBe(false);
	});

	it("an unreadable daemon is not a clause with no signal: nothing is reported broken for it", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, async () => ({ ok: false, reason: "no daemon" }));
		expect(signalRuleVerdicts(PLAN, result, null).some((v) => v.broken !== undefined)).toBe(false);
	});

	it("a close that never asked the daemon reports nothing", () => {
		expect(signalRuleVerdicts(PLAN, { ok: true, confirmed: [] }, null)).toEqual([]);
	});
});

describe("the live-check rule's own signal reads the impl as it stands at the close", () => {
	it("a saved impl holding a live check that names a clause is reported broken, naming the row and clause", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, upheldSignals());
		const impl = [
			"## Test Trajectory",
			"",
			"| ID | Asserts | Writable at | Passes at | State | Level | For | Test |",
			"|----|---------|-------------|-----------|-------|-------|-----|------|",
			"| L1 | a | Build Phase 1 | Build Phase 1 | planned | live check | clause: a-promise/a-clause | manual: x |",
			"",
		].join("\n");
		const verdicts = signalRuleVerdicts(PLAN, result, impl).filter(
			(v) => v.clause === "a-live-check-proves-no-clause",
		);
		expect(verdicts).toHaveLength(1);
		expect(verdicts[0].broken).toContain("L1");
		expect(verdicts[0].broken).toContain("a-promise/a-clause");
	});

	it("no such row: the clause reads upheld", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, upheldSignals());
		const verdicts = signalRuleVerdicts(PLAN, result, "## Test Trajectory\n").filter(
			(v) => v.clause === "a-live-check-proves-no-clause",
		);
		expect(verdicts).toEqual([
			{
				promise: "a-plan-with-clauses-carries-its-signals",
				clause: "a-live-check-proves-no-clause",
			},
		]);
	});
});

describe("the landed plan's close reads its three clauses", () => {
	it("closing a-brief-is-accepted-on-current-main with a clause at no signal reports it broken, by name", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, upheldSignals("b-clause"));
		const verdicts = signalRuleVerdicts("a-brief-is-accepted-on-current-main", result, null).filter(
			(v) => v.clause === "the-two-landed-plans-report",
		);
		expect(verdicts).toHaveLength(1);
		expect(verdicts[0].broken).toContain("a-promise/b-clause");
	});

	it("any other plan's close says nothing of the two landed plans", async () => {
		fixture = clausePlanProject();
		const result = await close(fixture, upheldSignals("b-clause"));
		const { tracer, spans } = captureTracer();
		await reportSignalRules(fixture.planRoot, PLAN, result, tracer);
		expect(outcomesByClause(spans)["the-two-landed-plans-report"]).toBeUndefined();
	});
});

/**
 * A101 (a-run-can-be-trusted, Build Phase 7, falsification): the contract check refusing a
 * draft impl on the two clause-signal rules is the rule's own verdict, which can never read
 * broken (Decisions 8 and 17), so it sends no upheld report of either clause; their signal is
 * `promises confirm`'s.
 */
describe("A101 — the contract check's refusal reports nothing of its own rules", () => {
	it("a draft impl refused for its missing signal tasks sends no span of either clause", async () => {
		fixture = clausePlanProject();
		commands.stdin = implText(PLAN, {
			status: "draft",
			keys: ["test_purpose: required"],
			columns: ["For", "Test"],
			rows: CLAUSES.map((c, i) => ({
				id: `A${i + 1}`,
				state: "planned",
				cells: { For: `clause: ${PROMISE}/${c.name}`, Test: testOf(c.name) },
			})),
		});
		commands.spans.length = 0;
		const errors: string[] = [];
		const err = vi.spyOn(console, "error").mockImplementation((m) => {
			errors.push(String(m));
		});
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const priorExit = process.exitCode;
		try {
			await promisesContract(fixture.planRoot, PLAN, { implStdin: true });
			// the refusal is the one the save check passes on: it refused for the missing signals
			expect(process.exitCode).toBe(2);
			expect(errors.join("\n")).toContain(`${PROMISE}/a-clause`);
		} finally {
			process.exitCode = priorExit;
			err.mockRestore();
			info.mockRestore();
		}
		const own = commands.spans.filter(
			(s) =>
				s.attrs["indusk.clause"] === "refused-without-signals" ||
				s.attrs["indusk.clause"] === "a-live-check-proves-no-clause",
		);
		expect(own).toEqual([]);
	});
});
