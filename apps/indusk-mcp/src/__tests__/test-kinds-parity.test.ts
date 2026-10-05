import { describe, expect, it } from "vitest";
import { TEST_KINDS as HOOKS } from "../../hooks/_test-kinds.js";
import { TEST_KINDS } from "../lib/test-kinds.js";
import { parseTrajectory } from "../lib/trajectory/parser.js";
import { validateTestKinds } from "../lib/trajectory/validator.js";

/**
 * test-kinds — the hooks' copy of the five kinds is the package's, and the
 * package's validator refuses what the hook refuses (A18 drives the hook). A
 * copy that falls behind refuses a kind the planner offers, or accepts one it
 * does not.
 */

const table = (kind: string | null) =>
	[
		"## Test Trajectory",
		"",
		kind === null
			? "| ID | Asserts | Writable at | Passes at | State |"
			: "| ID | Asserts | Writable at | Passes at | State | Kind |",
		kind === null ? "|----|----|----|----|----|" : "|----|----|----|----|----|----|",
		kind === null
			? "| T1 | a rule holds | Phase 1 | Phase 1 | planned |"
			: `| T1 | a rule holds | Phase 1 | Phase 1 | planned | ${kind} |`,
	].join("\n");

describe("the five kinds, one list", () => {
	it("the hooks' copy equals the package's definition", () => {
		expect([...HOOKS]).toEqual([...TEST_KINDS]);
	});

	it("the package's validator accepts a kind, refuses another word and a missing column, and checks nothing when not required", () => {
		const errors = (kind: string | null, required = true) =>
			validateTestKinds(parseTrajectory(table(kind)), required).map((e) => e.rule);
		expect(errors("live check")).toEqual([]);
		expect(errors("example")).toEqual(["test-kinds"]);
		expect(errors(null)).toEqual(["test-kinds"]);
		expect(errors("example", false)).toEqual([]);
	});
});
