import { describe, expect, it } from "vitest";
import { TEST_LEVELS as HOOK_LEVELS } from "../../hooks/_test-levels.js";
import { parseTrajectoryFromBody } from "../../hooks/_trajectory-parser.js";
import { TEST_KINDS } from "../lib/test-kinds.js";
import { TEST_LEVELS } from "../lib/test-levels.js";
import { parseTrajectory } from "../lib/trajectory/parser.js";
import { validateRowPurpose, validateTestLevels } from "../lib/trajectory/validator.js";

/**
 * promise: one-definition-per-shared-rule — planner-promises A16.
 *
 * The hooks cannot import TypeScript, so they carry a copy of the trajectory
 * parser. The row's level and what the row is for are read by both, and a
 * copy that falls behind does not announce itself: the validator would refuse
 * a row the package accepts, or wave one through. Both read the same table
 * here and must say the same thing.
 */

const TABLE = [
	"## Test Trajectory",
	"",
	"| ID | Asserts | Writable at | Passes at | State | Level | For |",
	"|----|---------|-------------|-----------|-------|-------|-----|",
	"| T1 | a seat is held once | Test Phase 1 | Build Phase 1 | planned | unit | promise: seat-never-double-booked |",
	"| T2 | the map is read once | Test Phase 1 | Build Phase 1 | planned | contract | lesson: a-seat-is-held-in-one-statement |",
	"| T3 | old maps still load | Test Phase 1 | Build Phase 1 | planned | unit | a regression guard over the old seat map |",
	"| T4 | both hold | Test Phase 1 | Build Phase 1 | planned | live check | promise: seat-never-double-booked, promise: seat-released-on-timeout, lesson: a-seat-is-held-in-one-statement |",
	"| T5 | nothing said | Test Phase 1 | Build Phase 1 | planned | unit |  |",
].join("\n");

const EXPECTED = [
	{
		id: "T1",
		level: "unit",
		purpose: { promises: ["seat-never-double-booked"], lessons: [], reason: null },
	},
	{
		id: "T2",
		level: "contract",
		purpose: { promises: [], lessons: ["a-seat-is-held-in-one-statement"], reason: null },
	},
	{
		id: "T3",
		level: "unit",
		purpose: { promises: [], lessons: [], reason: "a regression guard over the old seat map" },
	},
	{
		id: "T4",
		level: "live check",
		purpose: {
			promises: ["seat-never-double-booked", "seat-released-on-timeout"],
			lessons: ["a-seat-is-held-in-one-statement"],
			reason: null,
		},
	},
	{ id: "T5", level: "unit", purpose: null },
];

// Fields are read loosely: the row's level and purpose are what this plan
// adds, and before it neither parser returns them.
type Loose = { id: string; levelText?: string | null; level?: string | null; purpose?: unknown };

describe("planner-promises A16 — the two row parsers agree", () => {
	it("the package's parser reads each row's level and what it is for", () => {
		const rows = parseTrajectory(TABLE).rows as unknown as Loose[];
		expect(
			rows.map((r) => ({ id: r.id, level: r.levelText ?? null, purpose: r.purpose ?? null })),
		).toEqual(EXPECTED);
	});

	it("the hooks' copy reads the same", () => {
		const rows = parseTrajectoryFromBody(TABLE).rows as unknown as Loose[];
		expect(
			rows.map((r) => ({ id: r.id, level: r.level ?? null, purpose: r.purpose ?? null })),
		).toEqual(EXPECTED);
	});

	it("a `Kind` header is read as the level when there is no `Level` header", () => {
		const old = TABLE.replace("| Level |", "| Kind |");
		const ts = parseTrajectory(old).rows as unknown as Loose[];
		const hook = parseTrajectoryFromBody(old).rows as unknown as Loose[];
		expect(ts.map((r) => r.levelText ?? null)).toEqual(EXPECTED.map((e) => e.level));
		expect(hook.map((r) => r.level ?? null)).toEqual(EXPECTED.map((e) => e.level));
	});
});

describe("planner-promises A16 — the five levels, one list", () => {
	it("the hooks' copy equals the package's definition", () => {
		expect([...HOOK_LEVELS]).toEqual([...TEST_LEVELS]);
	});

	it("the name 1.61.0 published still resolves to the same list", () => {
		expect([...TEST_KINDS]).toEqual([...TEST_LEVELS]);
	});
});

/**
 * The package's validator refuses what the hook refuses (A5 and A19 drive the
 * hook): the rule lives in both, and they are compared here on one table.
 */
describe("planner-promises A16 — the package's validator matches the hook's", () => {
	const rules = (errors: Array<{ rule: string }>) => errors.map((e) => e.rule);
	const parsed = parseTrajectory(TABLE);
	const bare = parseTrajectory(
		[
			"## Test Trajectory",
			"",
			"| ID | Asserts | Writable at | Passes at | State |",
			"|----|----|----|----|----|",
			"| T1 | a rule holds | Phase 1 | Phase 1 | planned |",
		].join("\n"),
	);

	it("levels: accepts the five, refuses another word and a missing column, checks nothing unless required", () => {
		expect(rules(validateTestLevels(parsed, true))).toEqual([]);
		expect(
			rules(
				validateTestLevels(
					parseTrajectory(TABLE.replace("| unit | promise", "| example | promise")),
					true,
				),
			),
		).toEqual(["test-levels"]);
		expect(rules(validateTestLevels(bare, true))).toEqual(["test-levels"]);
		expect(rules(validateTestLevels(bare, false))).toEqual([]);
	});

	it("purpose: refuses the row that says nothing and a missing column, checks nothing unless required", () => {
		const errors = validateRowPurpose(parsed, true);
		expect(rules(errors)).toEqual(["test-purpose"]);
		expect(errors[0].message).toMatch(/\bT5\b/);
		expect(rules(validateRowPurpose(bare, true))).toEqual(["test-purpose"]);
		expect(rules(validateRowPurpose(bare, false))).toEqual([]);
	});
});
