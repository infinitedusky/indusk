import { describe, expect, it } from "vitest";
import { appendFindingToPhase } from "./findings.js";
import { implWithPhase } from "./shape.test-support.js";

/**
 * A1, A2 — a finding becomes work, in the right place.
 *
 * `appendFindingToPhase` returns the edited body and never writes. The caller
 * owns the write, so the edit flows through the PreToolUse gate chain like any
 * other impl edit — a library that wrote impl.md directly would be a hole in
 * the gate by construction, which is exactly what `atdawn run`'s falsification
 * found when bash was rewriting checkboxes the edit gate would have refused.
 */

const FINDING = {
	file: "src/lib/verify/report.ts",
	change: "Extract the finding renderer into a named pure function",
	rule: "react/one-component-per-file — a unit with its own reason to change wants its own name",
};

describe("A1 — the item names both the change and the rule", () => {
	it("includes the change to make", () => {
		const body = implWithPhase({
			phase: 3,
			items: [[true, "build the thing"]],
			verification: [[true, "tests pass"]],
		});

		const out = appendFindingToPhase(body, 3, FINDING);

		expect(out).toContain("Extract the finding renderer into a named pure function");
	});

	it("includes the rule the finding came from", () => {
		// A finding without its basis is unreviewable — you cannot judge whether
		// to accept it without knowing which standard produced it.
		const body = implWithPhase({
			phase: 3,
			items: [[true, "build the thing"]],
			verification: [[true, "tests pass"]],
		});

		const out = appendFindingToPhase(body, 3, FINDING);

		expect(out).toContain("one-component-per-file");
	});

	it("adds it unchecked, so the phase cannot close while it is outstanding", () => {
		const body = implWithPhase({
			phase: 3,
			items: [[true, "build the thing"]],
			verification: [[true, "tests pass"]],
		});

		const out = appendFindingToPhase(body, 3, FINDING);
		const added = out
			.split("\n")
			.find((l) => l.includes("Extract the finding renderer"));

		expect(added?.trimStart().startsWith("- [ ]")).toBe(true);
	});
});

describe("A2 — the item lands in the phase that produced the code", () => {
	it("appends to the named phase, not a new one", () => {
		const body = implWithPhase({
			phase: 2,
			items: [[true, "build the thing"]],
			verification: [[true, "tests pass"]],
		});

		const out = appendFindingToPhase(body, 2, FINDING);

		// No new phase heading appeared.
		const phaseHeadings = out.split("\n").filter((l) => /^### Phase \d+:/.test(l));
		expect(phaseHeadings).toHaveLength(1);
	});

	it("places the item within the target phase's implementation block", () => {
		const body = [
			implWithPhase({
				phase: 1,
				items: [[true, "phase one work"]],
				verification: [[true, "tests pass"]],
			}),
			implWithPhase({
				phase: 2,
				items: [[true, "phase two work"]],
				verification: [[true, "tests pass"]],
			})
				.split("## Checklist")[1],
		].join("\n");

		const out = appendFindingToPhase(body, 1, FINDING);
		const lines = out.split("\n");
		const findingAt = lines.findIndex((l) => l.includes("Extract the finding renderer"));
		const phase2At = lines.findIndex((l) => /^### Phase 2:/.test(l));

		expect(findingAt).toBeGreaterThan(-1);
		expect(phase2At).toBeGreaterThan(-1);
		expect(findingAt).toBeLessThan(phase2At);
	});

	it("refuses when the named phase does not exist rather than guessing", () => {
		const body = implWithPhase({
			phase: 1,
			items: [[true, "work"]],
			verification: [[true, "tests pass"]],
		});

		expect(() => appendFindingToPhase(body, 9, FINDING)).toThrow(/phase 9/i);
	});
});
