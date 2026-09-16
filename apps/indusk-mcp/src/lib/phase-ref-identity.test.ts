import { describe, expect, it } from "vitest";
import { findPhase, getPhaseCompletion, parseImplString } from "./impl-parser.js";
import { findPhaseStart, type PhaseBoundaryRecord } from "./shape/boundary.js";

/**
 * admin-ui-phase-progress — A19.
 *
 * Phase identity was a bare number in every reader that mattered: the
 * completion record, the boundary record, the Shape surface. With two
 * sequences, "phase 1" names two different phases, and each reader picked one
 * silently. This pins the two readers that key it now: `getPhaseCompletion`
 * over `findPhase(parsed, ref)` reports Test Phase 1 and Build Phase 1
 * separately, and `findPhaseStart` keeps their boundary records apart — with
 * a record that carries no `kind` reading as build, by rule.
 */

const IMPL = [
	"## Checklist",
	"",
	"### Test Phase 1: Author",
	"",
	"- [x] one",
	"- [ ] two",
	"- [ ] three",
	"",
	"#### Test Phase 1 Verification",
	"",
	"- [ ] red",
	"",
	"### Build Phase 1: Build",
	"",
	"- [x] a",
	"- [x] b",
	"- [x] c",
	"- [x] d",
	"",
	"#### Build Phase 1 Verification",
	"",
	"- [x] green",
	"",
].join("\n");

function rec(overrides: Partial<PhaseBoundaryRecord>): PhaseBoundaryRecord {
	return { plan: "p", phase: 1, sha: "abc", timestamp: "2026-09-16T00:00:00.000Z", ...overrides };
}

describe("A19 — Test Phase 1 and Build Phase 1 are kept apart", () => {
	it("getPhaseCompletion reports each phase's own counts and carries its ref", () => {
		const parsed = parseImplString(IMPL);
		const test1 = findPhase(parsed, { kind: "test", number: 1 });
		const build1 = findPhase(parsed, { kind: "build", number: 1 });
		expect(test1).toBeDefined();
		expect(build1).toBeDefined();
		if (!test1 || !build1) return;
		expect(getPhaseCompletion(test1)).toMatchObject({
			ref: { kind: "test", number: 1 },
			totalItems: 4,
			checkedItems: 1,
		});
		expect(getPhaseCompletion(build1)).toMatchObject({
			ref: { kind: "build", number: 1 },
			totalItems: 5,
			checkedItems: 5,
		});
	});

	it("findPhaseStart keys on kind; a record without kind is a build record by rule", () => {
		const legacy = rec({});
		const test = rec({ kind: "test", sha: "def" });
		const records = [legacy, test];
		expect(findPhaseStart(records, "p", { kind: "build", number: 1 })).toBe(legacy);
		expect(findPhaseStart(records, "p", { kind: "test", number: 1 })).toBe(test);
		// The bare-number shorthand names the build phase, like `### Phase N`.
		expect(findPhaseStart(records, "p", 1)).toBe(legacy);
		expect(findPhaseStart([test], "p", 1)).toBeNull();
	});
});
