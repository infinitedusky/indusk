// A18: the files a plan runs at a phase and at landing are pinned, so recording a run never changes them.
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

const row = (id: string, at: string, tests: string[]): TestSetRow => ({
	id,
	writableAt: phase(at).number,
	writableAtKind: phase(at).kind,
	passesAt: phase(at).number,
	passesAtKind: phase(at).kind,
	test: tests,
});

const reads = {
	rows: [
		row("A1", "Build Phase 1", ["one.test.ts"]),
		row("A2", "Build Phase 2", ["two.test.ts", "manual: look at it"]),
		row("A3", "Test Phase 1", ["zero.test.ts"]),
	],
	mustNotBreak: ["kept", "bare"],
	registry: [
		{ name: "kept", tests: ["kept.test.ts"] },
		{ name: "bare", tests: [] },
	],
};

it("A18 a build phase runs its own rows' files, then the protected promises' files", () => {
	expect(planTestSet(reads, { phase: phase("Build Phase 1") })).toEqual({
		files: [
			{ path: "one.test.ts", reason: "row A1" },
			{ path: "kept.test.ts", reason: "must not break: kept" },
		],
		withoutTests: ["bare"],
		manual: [],
	});
});

it("A18 a test phase runs only its own rows, apart from a build phase of the same number", () => {
	expect(planTestSet(reads, { phase: phase("Test Phase 1") }).files).toEqual([
		{ path: "zero.test.ts", reason: "row A3" },
		{ path: "kept.test.ts", reason: "must not break: kept" },
	]);
});

it("A18 landing runs every row's files and the protected promises' files, listing manual checks", () => {
	expect(planTestSet(reads, { landing: true })).toEqual({
		files: [
			{ path: "one.test.ts", reason: "row A1" },
			{ path: "two.test.ts", reason: "row A2" },
			{ path: "zero.test.ts", reason: "row A3" },
			{ path: "kept.test.ts", reason: "must not break: kept" },
		],
		withoutTests: ["bare"],
		manual: ["A2: look at it"],
	});
});
