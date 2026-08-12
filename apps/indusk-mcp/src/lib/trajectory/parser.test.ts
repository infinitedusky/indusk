import { describe, expect, it } from "vitest";
import { parseTrajectory } from "./parser.js";

const withTrajectory = (tableRows: string, deferredBlock = "") => `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${tableRows}
${deferredBlock}

## Checklist
`;

describe("parseTrajectory — T1: extracts the Test Trajectory table into typed rows", () => {
	it("parses a minimal valid table", () => {
		const body = withTrajectory("| T1 | checks a thing | Phase 1 | Phase 2 | planned |");
		const trajectory = parseTrajectory(body);
		expect(trajectory.present).toBe(true);
		expect(trajectory.rows).toEqual([
			{
				id: "T1",
				asserts: "checks a thing",
				writableAt: 1,
				passesAt: 2,
				// A cell with no sequence prefix means the build sequence, so
				// every row written before test phases existed keeps its meaning.
				writableAtKind: "build",
				passesAtKind: "build",
				state: "planned",
				kind: undefined,
				scope: undefined,
				test: undefined,
			},
		]);
	});

	it("parses multiple rows with different states", () => {
		const body = withTrajectory(
			`| T1 | first thing | Phase 1 | Phase 1 | passing |
| T2 | second thing | Phase 2 | Phase 3 | writable |
| T3 | third thing | Phase 1 | Phase 5 | planned |`,
		);
		const trajectory = parseTrajectory(body);
		expect(trajectory.rows.map((r) => r.id)).toEqual(["T1", "T2", "T3"]);
		expect(trajectory.rows.map((r) => r.state)).toEqual(["passing", "writable", "planned"]);
	});

	it("parses optional Kind and Scope columns when present", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | Kind | Scope | State |
|----|---------|-------------|-----------|------|-------|-------|
| T1 | property test | Phase 1 | Phase 1 | property | unit | planned |
| T2 | integration test | Phase 2 | Phase 3 | example | integration | planned |

## Checklist
`;
		const trajectory = parseTrajectory(body);
		expect(trajectory.rows[0].kind).toBe("property");
		expect(trajectory.rows[0].scope).toBe("unit");
		expect(trajectory.rows[1].kind).toBe("example");
		expect(trajectory.rows[1].scope).toBe("integration");
	});
});

describe("parseTrajectory — T2: extracts Deferred Verification rows with three fields", () => {
	it("parses a multi-line deferred row with sub-bullets", () => {
		const deferred = `
### Deferred Verification

- **LLM quality**
  - reason: cannot deterministically assert LLM output
  - would require: dedicated eval harness
  - mitigation: weekly spot-check + user feedback loop
`;
		const body = withTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", deferred);
		const trajectory = parseTrajectory(body);
		expect(trajectory.deferred).toEqual([
			{
				name: "LLM quality",
				reason: "cannot deterministically assert LLM output",
				wouldRequire: "dedicated eval harness",
				mitigation: "weekly spot-check + user feedback loop",
			},
		]);
	});

	it("parses multiple deferred rows", () => {
		const deferred = `
### Deferred Verification

- **First untestable**
  - reason: reason one
  - would require: unlock one
  - mitigation: mitigation one
- **Second untestable**
  - reason: reason two
  - would require: unlock two
  - mitigation: mitigation two
`;
		const body = withTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", deferred);
		const trajectory = parseTrajectory(body);
		expect(trajectory.deferred.length).toBe(2);
		expect(trajectory.deferred[0].name).toBe("First untestable");
		expect(trajectory.deferred[1].name).toBe("Second untestable");
	});
});

describe("parseTrajectory — T3: returns empty (not error) when section absent", () => {
	it("returns present=false when Test Trajectory heading missing", () => {
		const body = `# Some Plan

## Goal

Do a thing.

## Checklist

### Phase 1: Do it
- [ ] step one
`;
		const trajectory = parseTrajectory(body);
		expect(trajectory.present).toBe(false);
		expect(trajectory.rows).toEqual([]);
		expect(trajectory.deferred).toEqual([]);
	});

	it("does not throw on a completely empty string", () => {
		expect(() => parseTrajectory("")).not.toThrow();
		const trajectory = parseTrajectory("");
		expect(trajectory.present).toBe(false);
	});
});
