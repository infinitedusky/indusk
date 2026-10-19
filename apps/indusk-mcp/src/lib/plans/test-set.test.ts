// clause: a-plan-runs-its-tests-and-what-must-not-break/its-own-tests
// clause: a-plan-runs-its-tests-and-what-must-not-break/what-must-not-break
// clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs
// promise: a-plan-runs-its-tests-and-what-must-not-break
import { expect, it } from "vitest";
import { parsePhaseRef } from "../impl-headings.js";
import type { TestSetRow } from "./test-set.js";
import { planTestSet } from "./test-set.js";

const phase = (label: string) => {
	const ref = parsePhaseRef(label);
	if (!ref) throw new Error(`not a phase: ${label}`);
	return ref;
};

/** A trajectory row as the parser reads it: a phase is a number and the sequence it counts in. */
const row = (id: string, at: string, tests: string[]): TestSetRow => ({
	id,
	writableAt: phase(at).number,
	writableAtKind: phase(at).kind,
	passesAt: phase(at).number,
	passesAtKind: phase(at).kind,
	test: tests,
});

const rows = [row("T1", "Build Phase 1", ["a.test.ts"]), row("T2", "Build Phase 2", ["b.test.ts"])];
const reads = {
	rows,
	mustNotBreak: ["kept"],
	registry: [
		{ name: "kept", tests: ["k.test.ts"] },
		{ name: "bare", tests: [] },
	],
};

it("T1 a phase gets its rows' files and none from a later phase", () => {
	const set = planTestSet(reads, { phase: phase("Build Phase 1") });
	expect(set.files.map((f) => f.path)).toContain("a.test.ts");
	expect(set.files.map((f) => f.path)).not.toContain("b.test.ts");
});

it("T1 a test phase and a build phase of the same number are different phases", () => {
	const mixed = [
		row("T1", "Test Phase 1", ["t.test.ts"]),
		row("T2", "Build Phase 1", ["b.test.ts"]),
	];
	const set = planTestSet(
		{ ...reads, rows: mixed, mustNotBreak: [] },
		{ phase: phase("Build Phase 1") },
	);
	expect(set.files.map((f) => f.path)).toEqual(["b.test.ts"]);
});

// A search for the tests a change imports is no longer made, so a caller that still
// hands one in changes nothing: a test a file merely imports does not run.
const withReached = { ...reads, reached: ["r.test.ts"] };

it("T1 a phase's set holds the Must-not-break promises' tests, named for the promise", () => {
	const set = planTestSet(reads, { phase: phase("Build Phase 1") });
	expect(set.files).toContainEqual({ path: "k.test.ts", reason: "must not break: kept" });
});

it("T1 a phase's set is its rows and the Must-not-break tests and nothing a change merely imports", () => {
	const set = planTestSet(withReached, { phase: phase("Build Phase 1") });
	expect(set.files.map((f) => f.path).sort()).toEqual(["a.test.ts", "k.test.ts"]);
});

it("T1 a phase names a Must-not-break promise that lists no test, as a landing does", () => {
	const set = planTestSet({ ...reads, mustNotBreak: ["bare"] }, { phase: phase("Build Phase 1") });
	expect(set.withoutTests).toEqual(["bare"]);
});

it("T4 landing adds every Must-not-break promise's tests", () => {
	const set = planTestSet(reads, { landing: true });
	expect(set.files).toContainEqual({ path: "k.test.ts", reason: "must not break: kept" });
});

it("T5 a Must-not-break promise with no tests is named", () => {
	const set = planTestSet({ ...reads, mustNotBreak: ["bare"] }, { landing: true });
	expect(set.withoutTests).toEqual(["bare"]);
});

it("T5 a Must-not-break promise the registry does not hold is named, not dropped", () => {
	const set = planTestSet({ ...reads, mustNotBreak: ["gone"] }, { landing: true });
	expect(set.withoutTests).toEqual(["gone"]);
});

it("T4 a Must-not-break promise is found by an earlier name", () => {
	const registry = [{ name: "kept-now", aliases: ["kept"], tests: ["k.test.ts"] }];
	const set = planTestSet({ ...reads, registry }, { landing: true });
	expect(set.files.map((f) => f.path)).toContain("k.test.ts");
});

it("T2 landing holds every row's files and the Must-not-break tests, and nothing a change merely imports", () => {
	const set = planTestSet(withReached, { landing: true });
	expect(set.files.map((f) => f.path).sort()).toEqual(["a.test.ts", "b.test.ts", "k.test.ts"]);
});

it("T2 a file two reasons name is in the set once", () => {
	const both = { ...reads, registry: [{ name: "kept", tests: ["a.test.ts"] }] };
	const set = planTestSet(both, { landing: true });
	expect(set.files.filter((f) => f.path === "a.test.ts")).toHaveLength(1);
});

it("T1 a row's manual reference is listed as manual, not run", () => {
	const manual = [row("T9", "Build Phase 1", ["manual: signed off by Sandy"])];
	const set = planTestSet(
		{ ...reads, rows: manual, mustNotBreak: [] },
		{ phase: phase("Build Phase 1") },
	);
	expect(set.files).toEqual([]);
	expect(set.manual).toEqual(["T9: signed off by Sandy"]);
});
