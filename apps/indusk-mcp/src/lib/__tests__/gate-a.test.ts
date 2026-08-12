import { describe, expect, it } from "vitest";
import { check, gateTransition } from "../../__tests__/helpers/hook-runner.js";

/**
 * A6, A7, A9 — Gate A, corrected.
 *
 * Today the gate reads `row.writableAt === advancingPhase`. Two consequences,
 * and this plan exists because of the first:
 *
 *   - `advancingPhase` is never 0, and 260 of 444 rows across the corpus are
 *     `Writable at: Phase 0`. The default case cannot fire. Ever.
 *   - Exact match means a row is checked at exactly one moment. Miss it and it
 *     is never checked again — the phase it was due at has passed, and no later
 *     phase asks.
 *
 * A6 and A9 are the first; A7 is the second.
 */

const FRONTMATTER = [
	"---",
	'title: "Fixture"',
	"status: in-progress",
	"trajectory: required",
	"rationale: required",
	"test_phases: required",
	"gate_policy: auto",
	"---",
	"",
	"# Fixture",
	"",
].join("\n");

function trajectory(rows: string[]): string {
	return [
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State |",
		"|----|---------|-------------|-----------|-------|",
		...rows,
		"",
	].join("\n");
}

function buildPhase(n: number, opts: { done: boolean; verifies: string[] }): string[] {
	const box = opts.done ? "x" : " ";
	return [
		`### Build Phase ${n}: Build`,
		"",
		`- [${box}] do thing ${n}`,
		"",
		`#### Build Phase ${n} Verification`,
		...opts.verifies.map((id) => `- [${box}] ${id} passes`),
		"",
		`#### Build Phase ${n} Context`,
		`- [${box}] (none needed)`,
		"",
		`#### Build Phase ${n} Document`,
		`- [${box}] (none needed)`,
		"",
	];
}

describe("A6 — build work cannot proceed while a test phase has unauthored tests", () => {
	const BEFORE = [
		FRONTMATTER,
		trajectory([
			// Authored in Test Phase 1, and still `planned` — the test does not exist.
			"| T1 | a thing is true | Test Phase 1 | Build Phase 1 | planned |",
		]),
		"## Checklist",
		"",
		"### Test Phase 1: Author the tests",
		"",
		"- [ ] Author T1 as RED",
		"",
		"#### Test Phase 1 Verification",
		"- [ ] T1 is authored and fails on its own assertion",
		"",
		...buildPhase(1, { done: false, verifies: ["T1"] }),
	].join("\n");

	it("is refused, naming the unauthored test", async () => {
		const result = await gateTransition(BEFORE, check(BEFORE, "do thing 1"));

		expect(result.exitCode).toBe(2);
		expect(result.stderr).toMatch(/T1/);
		// Pinned to Gate A specifically. Without this the case passes on the
		// *gate-completeness* refusal instead — Test Phase 1's Verification is
		// also unchecked here, and its item text happens to contain "T1", so
		// `/T1/` alone is satisfied by a message that says nothing about the
		// test being unauthored. A green for the wrong reason is worse than a
		// red, because it retires the question.
		expect(result.stderr).toMatch(/test-first/i);
	}, 30_000);
});

describe("A7 — an unauthored test is caught at any later close, not only its own", () => {
	/**
	 * The failure this guards against is the one `lifecycle-rebalance` actually
	 * hit: five rows authored four phases late, with nothing objecting at any
	 * point in between. Under exact-match the gate asks once. If the answer is
	 * wrong and the plan keeps going, it is never asked again.
	 */
	const BEFORE = [
		FRONTMATTER,
		trajectory([
			"| T1 | a thing is true | Test Phase 1 | Build Phase 1 | passing |",
			// Due in Test Phase 1, never authored. Build Phase 1 has already closed.
			"| T2 | another thing is true | Test Phase 1 | Build Phase 2 | planned |",
		]),
		"## Checklist",
		"",
		"### Test Phase 1: Author the tests",
		"",
		"- [x] Author T1 as RED",
		"",
		"#### Test Phase 1 Verification",
		"- [x] T1 is authored and fails on its own assertion",
		"",
		...buildPhase(1, { done: true, verifies: ["T1"] }),
		...buildPhase(2, { done: false, verifies: ["T2"] }),
	].join("\n");

	it("Build Phase 2 is refused for a test that was due in Test Phase 1", async () => {
		const result = await gateTransition(BEFORE, check(BEFORE, "do thing 2"));

		expect(result.exitCode).toBe(2);
		expect(result.stderr).toMatch(/T2/);
	}, 30_000);
});

describe("A9 — a test phase cannot close while a test it authors is unwritten", () => {
	/**
	 * Distinct from A6: A6 is about build work starting, A9 is about the test
	 * phase itself finishing. They come apart because the test phase's close is
	 * the review of its own deferrals — the U1 compensating control — and a
	 * phase that can close with unwritten tests has nothing to review.
	 */
	const BEFORE = [
		FRONTMATTER,
		trajectory(["| T1 | a thing is true | Test Phase 1 | Build Phase 1 | planned |"]),
		"## Checklist",
		"",
		"### Test Phase 1: Author the tests",
		"",
		"- [x] Author T1 as RED",
		"",
		"#### Test Phase 1 Verification",
		"- [ ] T1 is authored and fails on its own assertion",
		"",
		...buildPhase(1, { done: false, verifies: ["T1"] }),
	].join("\n");

	it("checking the test phase's own gate is refused while T1 is unwritten", async () => {
		const after = check(BEFORE, "T1 is authored and fails on its own assertion");
		const result = await gateTransition(BEFORE, after);

		expect(result.exitCode).toBe(2);
		expect(result.stderr).toMatch(/T1/);
	}, 30_000);
});
