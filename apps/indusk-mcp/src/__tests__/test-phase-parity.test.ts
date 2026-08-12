import { describe, expect, it } from "vitest";
import { validateTrajectory } from "../lib/trajectory/validator.js";
import { validateWrite } from "./helpers/hook-runner.js";

/**
 * A24 — the TS validator and the JS hook agree on every test-phase rule.
 *
 * **A regression guard, green on arrival, and declared as such.** Both
 * implementations were written together in Build Phase 3, so this has no red
 * phase and should not be given one. It earns its place because the port is a
 * *manual mirror* — `rationale-baseline-parity.test.ts` exists for exactly this
 * reason, and this plan added five rules to both sides without putting any of
 * them under it. The next person to change a rule will change one side first.
 *
 * Each fixture is paired: the shape a rule must refuse, and the shape it must
 * accept. A parity test that only ever fed refusals would pass just as happily
 * against two implementations that refuse everything.
 */

const FM = (extra: string[] = []) =>
	[
		"---",
		'title: "Fixture"',
		"status: in-progress",
		"trajectory: required",
		"gate_policy: auto",
		...extra,
		"---",
		"",
		"# Fixture",
		"",
	].join("\n");

const table = (rows: string[]) =>
	[
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State |",
		"|----|---------|-------------|-----------|-------|",
		...rows,
		"",
	].join("\n");

const buildPhase = (n: number, ids: string[]) => [
	`### Build Phase ${n}: Build`,
	"",
	"- [ ] do the thing",
	"",
	`#### Build Phase ${n} Verification`,
	...ids.map((id) => `- [ ] ${id} passes`),
	"",
	`#### Build Phase ${n} Context`,
	"- [ ] (none needed)",
	"",
	`#### Build Phase ${n} Document`,
	"- [ ] (none needed)",
	"",
];

const testPhase1 = (register: string[], ids: string[]) => [
	"### Test Phase 1: Author the tests",
	"",
	...ids.map((id) => `- [ ] Author ${id} as RED`),
	"",
	...register,
	"#### Test Phase 1 Verification",
	...ids.map((id) => `- [ ] ${id} is authored`),
	"",
];

interface Fixture {
	name: string;
	/** `test_phases: required` unless the fixture is about its absence. */
	optIn: boolean;
	body: string;
}

const ROW = "| T1 | a thing is true | Test Phase 1 | Build Phase 1 | written |";
const GUARD_ROW = "| T1 | already true | Test Phase 1 | Test Phase 1 | passing |";

const fixtures: Fixture[] = [
	{
		name: "test-phase-presence: refuses an impl with no test phase",
		optIn: true,
		body: [table([ROW]), "## Checklist", "", ...buildPhase(1, ["T1"])].join("\n"),
	},
	{
		name: "test-phase-presence: accepts one that opens with a test phase",
		optIn: true,
		body: [
			table([ROW]),
			"## Checklist",
			"",
			...testPhase1([], ["T1"]),
			...buildPhase(1, ["T1"]),
		].join("\n"),
	},
	{
		name: "test-phase-justification: refuses an unjustified second test phase",
		optIn: true,
		body: [
			table([ROW, "| T2 | a later thing | Test Phase 2 | Build Phase 2 | planned |"]),
			"## Checklist",
			"",
			...testPhase1([], ["T1"]),
			...buildPhase(1, ["T1"]),
			"### Test Phase 2: Author the deferred test",
			"",
			"- [ ] Author T2 as RED",
			"",
			"#### Test Phase 2 Verification",
			"- [ ] T2 is authored",
			"",
			...buildPhase(2, ["T2"]),
		].join("\n"),
	},
	{
		name: "test-phase-justification: accepts a justified one",
		optIn: true,
		body: [
			table([ROW, "| T2 | a later thing | Test Phase 2 | Build Phase 2 | planned |"]),
			"## Checklist",
			"",
			...testPhase1(
				["#### Deferred to Test Phase 2", "", "- **T2** — its subject lands in Build Phase 1.", ""],
				["T1"],
			),
			...buildPhase(1, ["T1"]),
			"### Test Phase 2: Author the deferred test",
			"",
			"- [ ] Author T2 as RED",
			"",
			"#### Test Phase 2 Verification",
			"- [ ] T2 is authored",
			"",
			...buildPhase(2, ["T2"]),
		].join("\n"),
	},
	{
		name: "test-phase-gate: refuses a test phase with no Verification gate",
		optIn: true,
		body: [
			table([ROW]),
			"## Checklist",
			"",
			"### Test Phase 1: Author the tests",
			"",
			"- [ ] Author T1 as RED",
			"",
			...buildPhase(1, ["T1"]),
		].join("\n"),
	},
	{
		name: "regression-guard: refuses an undeclared green-on-arrival row",
		optIn: true,
		body: [
			table([GUARD_ROW]),
			"## Checklist",
			"",
			...testPhase1([], ["T1"]),
			...buildPhase(1, ["T1"]),
		].join("\n"),
	},
	{
		name: "regression-guard: accepts a declared one",
		optIn: true,
		body: [
			table([GUARD_ROW]),
			"## Checklist",
			"",
			...testPhase1(
				["#### Regression Guards", "", "- **T1** — a fact about the runner, not our code.", ""],
				["T1"],
			),
			...buildPhase(1, ["T1"]),
		].join("\n"),
	},
	{
		name: "unterminated-fence: refuses a carried body that is never closed",
		optIn: true,
		body: [
			table([ROW]),
			"## Checklist",
			"",
			...testPhase1(
				[
					"#### Deferred to Build Phase 1",
					"",
					"- **T1** — body:",
					"",
					"  ```typescript",
					"  const x = 1;",
					"",
				],
				["T1"],
			),
			...buildPhase(1, ["T1"]),
		].join("\n"),
	},
	{
		name: "backward compatibility: a plan with no opt-in and no test phase is accepted",
		optIn: false,
		body: [
			table(["| T1 | a thing is true | Phase 0 | Phase 1 | planned |"]),
			"## Checklist",
			"",
			...buildPhase(1, ["T1"]),
		].join("\n"),
	},
];

describe("A24 — TS validator ↔ JS hook parity on the test-phase rules", () => {
	for (const fx of fixtures) {
		it(`agrees on: ${fx.name}`, async () => {
			const full = `${FM(fx.optIn ? ["test_phases: required"] : [])}${fx.body}`;

			const tsPasses = validateTrajectory(fx.body, { testPhasesRequired: fx.optIn }).length === 0;
			const jsPasses = (await validateWrite(full)).exitCode === 0;

			expect({ fixture: fx.name, jsPasses }).toEqual({ fixture: fx.name, jsPasses: tsPasses });
		}, 30_000);
	}

	it("exercises both sides of the decision", () => {
		// A parity suite of refusals alone would pass against two
		// implementations that refuse everything.
		const accepts = fixtures.filter((f) => f.name.includes("accepts"));
		const refuses = fixtures.filter((f) => f.name.includes("refuses"));
		expect(accepts.length).toBeGreaterThan(1);
		expect(refuses.length).toBeGreaterThan(1);
	});
});
