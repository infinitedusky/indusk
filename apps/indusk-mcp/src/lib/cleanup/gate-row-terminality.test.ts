import { describe, expect, it } from "vitest";
import { auditPlanAtClose } from "../trajectory/audit.js";
import { checkRetrospectiveReadiness } from "./gate.js";

/**
 * The close-out asks whether every row is terminal — the check the
 * retrospective skill's text always promised and the code never performed.
 *
 * The fixture is the shape workbench-trust-fixes closed in: both rituals
 * satisfied (skipped here, with reasons), every checkbox ticked, and a row
 * still `written` in a phase that exists. Eight phase closes passed it, because
 * `checkRetrospectiveReadiness` walked the ritual phases' checkboxes and
 * `auditPlanAtClose` reported `blocked` rows only. Carried into
 * dawn-workbench-execution from hook-cwd-independence's cut.
 */

function impl(state: string, passesAt = 1): string {
	return `---
title: "Fixture"
status: completed
trajectory: required
falsification: skipped
falsification_reason: "fixture"
cleanup: skipped
cleanup_reason: "fixture"
---

# Fixture

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a thing is true | Phase 0 | Phase ${passesAt} | ${state} |
| T2 | another thing is true | Phase 0 | Phase 1 | passing |

## Checklist

### Phase 1: The only phase

- [x] do the thing

#### Phase 1 Verification
- [x] T1 and T2 pass
`;
}

describe("close-out row terminality", () => {
	it("a `written` row whose phase exists blocks readiness, naming the row", () => {
		const r = checkRetrospectiveReadiness("/nonexistent", impl("written"));
		expect(r.rowsOk).toBe(false);
		expect(r.nonTerminalRows).toEqual(["T1"]);
		expect(r.missing).toContain("rows");
		expect(r.passes).toBe(false);
	});

	it("the same impl with the row `passing` is ready", () => {
		const r = checkRetrospectiveReadiness("/nonexistent", impl("passing"));
		expect(r.rowsOk).toBe(true);
		expect(r.nonTerminalRows).toEqual([]);
		expect(r.missing).toEqual([]);
		expect(r.passes).toBe(true);
	});

	it("`skipped` and `blocked` are terminal for a close; `planned` is not", () => {
		expect(checkRetrospectiveReadiness("/nonexistent", impl("skipped")).rowsOk).toBe(true);
		expect(checkRetrospectiveReadiness("/nonexistent", impl("blocked")).rowsOk).toBe(true);
		expect(checkRetrospectiveReadiness("/nonexistent", impl("planned")).nonTerminalRows).toEqual([
			"T1",
		]);
	});

	it("a row whose phase is not in the document is a forward reference, not a finding", () => {
		const r = checkRetrospectiveReadiness("/nonexistent", impl("written", 9));
		expect(r.rowsOk).toBe(true);
	});

	it("the close-out audit reports the same rows", () => {
		const body = impl("written").replace(/^---[\s\S]*?---\n/, "");
		const audit = auditPlanAtClose(body);
		expect(audit.nonTerminal.map((f) => f.row.id)).toEqual(["T1"]);
		expect(audit.nonTerminal[0].message).toMatch(/still 'written'/);
	});
});
