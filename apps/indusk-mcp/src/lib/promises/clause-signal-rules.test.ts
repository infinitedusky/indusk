// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals
// clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause
import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	CLAUSES,
	clausePlanProject,
	PLAN,
	PROMISE,
	testOf,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { parseTrajectory } from "../trajectory/parser.js";
import type { BriefContract } from "./brief-contract.js";
import {
	afterLandingClauseRows,
	clauseSignalRefusals,
	levelledRows,
	missingSignalTasks,
} from "./clause-signal-rules.js";
import { checkPlanContract } from "./contract.js";

/**
 * a-run-can-be-trusted A36–A40, A42–A45, A83: the two rules a plan written as clauses holds
 * its impl to. Pure functions over text and rows, so nothing here starts a process.
 */

const brief = (
	clauses: Array<{ name: string; kind: "split" | "limit" | "rests-on" }>,
	clausesRequired = true,
): BriefContract =>
	({
		shape: "contract",
		clausesRequired,
		makes: [
			{
				name: "a-promise",
				kind: "state",
				sentence: "It holds.",
				clauses: clauses.map((c) => ({ ...c, sentence: "A clause." })),
			},
		],
	}) as unknown as BriefContract;

const SPLIT_AND_LIMIT = [
	{ name: "a-clause", kind: "split" as const },
	{ name: "b-clause", kind: "limit" as const },
];

const task = (clause: string, path = "apps/x/src/lib/report.ts") =>
	[
		`- [ ] Report the clause.`,
		`  <details><summary>Technical</summary>`,
		``,
		`  signal: \`a-promise/${clause}\` — read in the daemon, reported from \`${path}\`.`,
		``,
		`  </details>`,
	].join("\n");

const impl = (...tasks: string[]) =>
	["# Impl", "", "### Build Phase 1: x", "", ...tasks, ""].join("\n");

describe("a task names a clause's signal (A36–A38)", () => {
	it("A36: an impl where no task names a clause's signal is refused, each clause as promise/clause", () => {
		expect(missingSignalTasks(brief(SPLIT_AND_LIMIT), impl("- [ ] Do a thing."))).toEqual([
			"a-promise/a-clause",
			"a-promise/b-clause",
		]);
		const refusals = clauseSignalRefusals(
			brief(SPLIT_AND_LIMIT),
			impl("- [ ] Do a thing."),
			parseTrajectory(""),
		);
		expect(refusals[0].message).toContain("a-promise/a-clause");
	});

	it("A37: with two clauses lacking a task and one present, exactly the two are named, each on its own line", () => {
		const three = [...SPLIT_AND_LIMIT, { name: "c-clause", kind: "split" as const }];
		const missing = missingSignalTasks(brief(three), impl(task("b-clause")));
		expect(missing).toEqual(["a-promise/a-clause", "a-promise/c-clause"]);
		const refusals = clauseSignalRefusals(
			brief(three),
			impl(task("b-clause")),
			parseTrajectory(""),
		);
		expect(refusals).toHaveLength(2);
		expect(refusals[0].message).toContain("a-promise/a-clause");
		expect(refusals[1].message).toContain("a-promise/c-clause");
	});

	it("A38: a task naming every split and limit clause's signal passes; a resting clause needs none", () => {
		const withResting = [...SPLIT_AND_LIMIT, { name: "r-clause", kind: "rests-on" as const }];
		expect(
			missingSignalTasks(brief(withResting), impl(task("a-clause"), task("b-clause"))),
		).toEqual([]);
	});
});

describe("where a signal task is found (A39, A83)", () => {
	it("A39: found in a task line or its folded detail, not in prose outside a task, not inside a fence", () => {
		const oneLine = `- [ ] signal: a-clause is reported by apps/x/src/lib/report.ts`;
		const justA = brief([SPLIT_AND_LIMIT[0]]);
		expect(missingSignalTasks(justA, impl(oneLine))).toEqual([]);
		const prose = impl(
			"The signal for a-clause is reported by apps/x/src/lib/report.ts.",
			"",
			"- [ ] Unrelated task.",
		);
		expect(missingSignalTasks(justA, prose)).toEqual(["a-promise/a-clause"]);
		const fenced = impl(
			"- [ ] Unrelated task.",
			"  ```",
			"  signal: a-clause apps/x/src/lib/report.ts",
			"  ```",
		);
		expect(missingSignalTasks(justA, fenced)).toEqual(["a-promise/a-clause"]);
	});

	it("A83: a task naming the clause and signal but no source file does not count", () => {
		const justA = brief([SPLIT_AND_LIMIT[0]]);
		expect(
			missingSignalTasks(justA, impl("- [ ] signal: a-clause is read from the daemon.")),
		).toEqual(["a-promise/a-clause"]);
		expect(
			missingSignalTasks(justA, impl("- [ ] signal: a-clause is reported by notes.md")),
		).toEqual(["a-promise/a-clause"]);
	});
});

describe("a brief or an impl the rule does not judge (A40)", () => {
	it("A40: a brief without clauses: required is not asked for signals", () => {
		expect(missingSignalTasks(brief(SPLIT_AND_LIMIT, false), impl("- [ ] Do a thing."))).toEqual(
			[],
		);
		expect(
			clauseSignalRefusals(brief(SPLIT_AND_LIMIT, false), impl("- [ ] x"), parseTrajectory("")),
		).toEqual([]);
	});
});

describe("a row that runs only after landing proves no clause (A42–A45)", () => {
	const row = (id: string, level: string, forCell: string) => ({ id, level, forCell });

	it("A42: a live check row naming a clause is refused naming the row and the clause", () => {
		expect(afterLandingClauseRows([row("L1", "live check", "clause: p/c")])).toEqual([
			{ row: "L1", clause: "p/c" },
		]);
		const table = [
			"## Test Trajectory",
			"",
			"| ID | Asserts | Writable at | Passes at | State | Level | For | Test |",
			"|----|---------|-------------|-----------|-------|-------|-----|------|",
			"| L1 | a thing | Build Phase 1 | Build Phase 1 | planned | live check | clause: a-promise/a-clause | manual: x |",
			"",
		].join("\n");
		const refusals = clauseSignalRefusals(
			brief(SPLIT_AND_LIMIT),
			impl(task("a-clause"), task("b-clause")),
			parseTrajectory(table),
		);
		expect(refusals).toHaveLength(1);
		expect(refusals[0].rule).toBe("a-live-check-proves-no-clause");
		expect(refusals[0].message).toContain("L1");
		expect(refusals[0].message).toContain("a-promise/a-clause");
		expect(refusals[0].message).toMatch(/after landing/);
	});

	it("A43: smoke and promise levels are refused too; unit and contract naming the clause are saved", () => {
		expect(
			afterLandingClauseRows([
				row("S1", "smoke", "clause: p/c"),
				row("P1", "promise", "clause: p/c"),
				row("U1", "unit", "clause: p/c"),
				row("C1", "contract", "clause: p/c"),
			]).map((r) => r.row),
		).toEqual(["S1", "P1"]);
	});

	it("A44: a live check row naming a promise, no clause, or a reason is saved", () => {
		expect(
			afterLandingClauseRows([
				row("L1", "live check", `${"promise"}: some-promise`),
				row("L2", "live check", "a live check after landing for another plan's close"),
				row("L3", "live check", ""),
				row("L4", "live check", undefined as unknown as string),
			]),
		).toEqual([]);
	});

	it("A45: a row with several For entries, one a clause, is refused for that entry", () => {
		expect(
			afterLandingClauseRows([row("L1", "live check", `${"promise"}: q, clause: p/c, lesson: l`)]),
		).toEqual([{ row: "L1", clause: "p/c" }]);
	});

	it("reads a parsed trajectory's rows by their level and For cells", () => {
		const table = [
			"## Test Trajectory",
			"",
			"| ID | Asserts | Writable at | Passes at | State | Level | For | Test |",
			"|----|---------|-------------|-----------|-------|-------|-----|------|",
			"| A1 | a | Build Phase 1 | Build Phase 1 | planned | smoke | clause: p/c | x |",
			"",
		].join("\n");
		expect(afterLandingClauseRows(levelledRows(parseTrajectory(table)))).toEqual([
			{ row: "A1", clause: "p/c" },
		]);
	});
});

/**
 * A40, second half, and the contract check's call of the two rules: the impl is judged on save
 * only while its status is `draft`. An impl past that is never newly refused for it, and the
 * sweep over every plan (which sets `skipDraft`) leaves a draft alone.
 */
let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const draftImpl = (status: string) =>
	implText(PLAN, {
		status,
		keys: ["test_purpose: required"],
		columns: ["For", "Test"],
		rows: CLAUSES.map((c, i) => ({
			id: `A${i + 1}`,
			state: "planned",
			cells: { For: `clause: ${PROMISE}/${c.name}`, Test: testOf(c.name) },
		})),
	});

const messages = (r: ReturnType<typeof checkPlanContract>) =>
	r.ok ? [] : r.refusals.map((x) => x.message);

describe("A40 — which impls are judged for signals", () => {
	it("a draft impl with no signal task is refused, each clause named, with the rule that refused", () => {
		fixture = clausePlanProject();
		const r = checkPlanContract(fixture.planRoot, PLAN, { implText: draftImpl("draft") });
		expect(r.ok).toBe(false);
		const text = messages(r).join("\n");
		expect(text).toContain(`${PROMISE}/a-clause`);
		expect(text).toContain(`${PROMISE}/b-clause`);
		if (!r.ok) expect(r.refusals.some((x) => x.rule === "refused-without-signals")).toBe(true);
	});

	it.each(["approved", "in-progress", "completed"])(
		"an impl already %s is not refused for its signals",
		(status) => {
			fixture = clausePlanProject();
			const r = checkPlanContract(fixture.planRoot, PLAN, { implText: draftImpl(status) });
			expect(messages(r).join("\n")).not.toMatch(/signal/);
		},
	);

	it("the sweep over every plan (skipDraft) leaves a draft impl alone", () => {
		fixture = clausePlanProject();
		const r = checkPlanContract(fixture.planRoot, PLAN, {
			implText: draftImpl("draft"),
			skipDraft: true,
		});
		expect(messages(r).join("\n")).not.toMatch(/signal/);
	});

	it("only the signal rules are asked when clauseSignalsOnly is set, whatever else the contract holds", () => {
		fixture = clausePlanProject();
		const r = checkPlanContract(fixture.planRoot, PLAN, {
			implText: draftImpl("draft"),
			clauseSignalsOnly: true,
		});
		expect(r.ok).toBe(false);
		expect(messages(r).every((m) => /signal|runs only after landing/.test(m))).toBe(true);
	});
});

// promise: a-plan-with-clauses-carries-its-signals
