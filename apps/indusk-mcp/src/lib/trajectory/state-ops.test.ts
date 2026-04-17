import { describe, expect, it } from "vitest";
import { parseTrajectory } from "./parser.js";
import {
	computePhaseCloseBlockers,
	getPhaseCloseNudge,
	getPhaseStartNudge,
	getRowsBlockingPhaseClose,
	getRowsPassingAt,
	getRowsWritableAt,
	updateRowState,
} from "./state-ops.js";

const body = (rows: string) => `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
`;

describe("T15: getRowsWritableAt returns rows whose Writable at matches the phase", () => {
	it("returns only rows with matching Writable at and pre-written state", () => {
		const t = parseTrajectory(
			body(`| T1 | a | Phase 1 | Phase 1 | planned |
| T2 | b | Phase 2 | Phase 2 | planned |
| T3 | c | Phase 1 | Phase 3 | passing |`),
		);
		const rows = getRowsWritableAt(t, 1);
		expect(rows.map((r) => r.id)).toEqual(["T1"]);
	});

	it("filters out rows already in terminal states", () => {
		const t = parseTrajectory(
			body(`| T1 | a | Phase 1 | Phase 1 | passing |
| T2 | b | Phase 1 | Phase 1 | written |`),
		);
		const rows = getRowsWritableAt(t, 1);
		expect(rows).toEqual([]);
	});

	it("returns empty for phases with no writable rows", () => {
		const t = parseTrajectory(body("| T1 | a | Phase 1 | Phase 2 | planned |"));
		expect(getRowsWritableAt(t, 2)).toEqual([]);
	});
});

describe("T16: updateRowState rewrites the State column", () => {
	it("updates State for the named row, leaves others untouched", () => {
		const original = body(`| T1 | a | Phase 1 | Phase 1 | planned |
| T2 | b | Phase 1 | Phase 1 | planned |`);
		const updated = updateRowState(original, "T1", "passing");
		expect(updated).toContain("| T1 | a | Phase 1 | Phase 1 | passing |");
		expect(updated).toContain("| T2 | b | Phase 1 | Phase 1 | planned |");
	});

	it("is a no-op when state is already the target value", () => {
		const original = body("| T1 | a | Phase 1 | Phase 1 | passing |");
		expect(updateRowState(original, "T1", "passing")).toBe(original);
	});

	it("returns unchanged body when row ID not found", () => {
		const original = body("| T1 | a | Phase 1 | Phase 1 | planned |");
		expect(updateRowState(original, "T99", "passing")).toBe(original);
	});

	it("handles optional columns (Kind, Scope) without corrupting the row", () => {
		const withOptional = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | Kind | Scope | State |
|----|---------|-------------|-----------|------|-------|-------|
| T1 | a | Phase 1 | Phase 1 | property | unit | planned |

## Checklist
`;
		const updated = updateRowState(withOptional, "T1", "passing");
		expect(updated).toContain("| T1 | a | Phase 1 | Phase 1 | property | unit | passing |");
	});
});

describe("T17: check-gates blocks phase close when Passes at tests not passing", () => {
	it("getRowsBlockingPhaseClose returns rows whose Passes at equals phase and state is not terminal", () => {
		const t = parseTrajectory(
			body(`| T1 | a | Phase 1 | Phase 3 | passing |
| T2 | b | Phase 1 | Phase 3 | written |
| T3 | c | Phase 1 | Phase 3 | planned |
| T4 | d | Phase 1 | Phase 3 | skipped |`),
		);
		const blocking = getRowsBlockingPhaseClose(t, 3);
		expect(blocking.map((r) => r.id).sort()).toEqual(["T2", "T3"]);
	});

	it("computePhaseCloseBlockers returns structured error messages", () => {
		const raw = body(`| T1 | a | Phase 1 | Phase 3 | written |`);
		const blockers = computePhaseCloseBlockers(raw, 3);
		expect(blockers.length).toBe(1);
		expect(blockers[0].row.id).toBe("T1");
		expect(blockers[0].message).toContain("T1");
		expect(blockers[0].message).toContain("written");
		expect(blockers[0].message).toContain("Phase 3");
	});
});

describe("T18: check-gates allows phase close when all Passes at tests are passing", () => {
	it("returns empty blockers when every row at phase is passing or skipped", () => {
		const raw = body(`| T1 | a | Phase 1 | Phase 3 | passing |
| T2 | b | Phase 1 | Phase 3 | skipped |
| T3 | c | Phase 1 | Phase 3 | blocked |`);
		expect(computePhaseCloseBlockers(raw, 3)).toEqual([]);
	});

	it("returns empty when no rows have Passes at equal to the phase", () => {
		const raw = body("| T1 | a | Phase 1 | Phase 2 | written |");
		expect(computePhaseCloseBlockers(raw, 3)).toEqual([]);
	});

	it("returns empty when trajectory is absent", () => {
		expect(computePhaseCloseBlockers("# Plan\nno trajectory here\n", 1)).toEqual([]);
	});
});

describe("T19: gate-reminder nudges about writable-at tests at phase start", () => {
	it("getPhaseStartNudge lists writable-at rows for the phase", () => {
		const raw = body(`| T1 | first test | Phase 2 | Phase 2 | planned |
| T2 | second test | Phase 2 | Phase 3 | planned |
| T3 | third test | Phase 1 | Phase 1 | passing |`);
		const nudge = getPhaseStartNudge(raw, 2);
		expect(nudge).toContain("Phase 2");
		expect(nudge).toContain("T1");
		expect(nudge).toContain("T2");
		expect(nudge).not.toContain("T3");
	});

	it("returns null when phase has nothing to author", () => {
		const raw = body("| T1 | a | Phase 1 | Phase 1 | passing |");
		expect(getPhaseStartNudge(raw, 3)).toBeNull();
	});

	it("getPhaseCloseNudge names rows blocking the close", () => {
		const raw = body(`| T1 | a | Phase 1 | Phase 3 | written |
| T2 | b | Phase 1 | Phase 3 | passing |`);
		const nudge = getPhaseCloseNudge(raw, 3);
		expect(nudge).toContain("T1");
		expect(nudge).toContain("written");
		expect(nudge).not.toContain("T2");
	});

	it("getPhaseCloseNudge returns null when all rows green", () => {
		const raw = body("| T1 | a | Phase 1 | Phase 3 | passing |");
		expect(getPhaseCloseNudge(raw, 3)).toBeNull();
	});
});

describe("getRowsPassingAt", () => {
	it("returns rows regardless of state (used by both gate-reminder and check-gates)", () => {
		const t = parseTrajectory(
			body(`| T1 | a | Phase 1 | Phase 3 | passing |
| T2 | b | Phase 1 | Phase 3 | written |
| T3 | c | Phase 1 | Phase 2 | passing |`),
		);
		expect(
			getRowsPassingAt(t, 3)
				.map((r) => r.id)
				.sort(),
		).toEqual(["T1", "T2"]);
	});
});
