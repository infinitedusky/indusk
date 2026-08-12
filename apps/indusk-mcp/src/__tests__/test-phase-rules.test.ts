import { describe, expect, it } from "vitest";
import { validateWrite } from "./helpers/hook-runner.js";

/**
 * A1, A2, A3, A14, A8 — the rules that make Test Phase 1 a register.
 *
 * ## The opt-in, and why these rules need one
 *
 * A1 says an impl with no test phase is refused. A4 says every impl already in
 * the repository still validates. Every impl already in the repository has no
 * test phase — so read literally, the two assertions contradict, and authoring
 * them together is what surfaced it.
 *
 * The resolution is the one `trajectory: required` already established: the
 * rule fires only when the frontmatter asks for it. `/planner` writes
 * `test_phases: required` into new impls; existing impls do not carry it and
 * are exempt, which is the same mechanism that let tests-first roll out across
 * 52 files without migrating one of them. The alternative — dating impls, or
 * exempting `archive/` by path — makes the rule a property of where a file
 * lives rather than of what it claims about itself.
 *
 * The exemption is asserted here explicitly, not assumed, because it is the
 * hinge the whole backward-compatibility story hangs on.
 */

function frontmatter(extra: string[] = []): string {
	return [
		"---",
		'title: "Fixture"',
		"status: in-progress",
		"trajectory: required",
		"rationale: required",
		"gate_policy: auto",
		...extra,
		"---",
		"",
		"# Fixture",
		"",
	].join("\n");
}

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

function buildPhase(n: number, rows: string[]): string[] {
	return [
		`### Build Phase ${n}: Build`,
		"",
		"- [ ] do the thing",
		"",
		`#### Build Phase ${n} Verification`,
		...rows.map((id) => `- [ ] ${id} passes`),
		"",
		`#### Build Phase ${n} Context`,
		"- [ ] (none needed)",
		"",
		`#### Build Phase ${n} Document`,
		"- [ ] (none needed)",
		"",
	];
}

describe("A1 — an impl with no test phase is refused", () => {
	const NO_TEST_PHASE = [
		frontmatter(["test_phases: required"]),
		trajectory(["| T1 | a thing is true | Phase 0 | Phase 1 | planned |"]),
		"## Checklist",
		"",
		"### Build Phase 1: Build",
		"",
		"- [ ] do the thing",
		"",
		"#### Build Phase 1 Verification",
		"- [ ] T1 passes",
		"",
		"#### Build Phase 1 Context",
		"- [ ] (none needed)",
		"",
		"#### Build Phase 1 Document",
		"- [ ] (none needed)",
		"",
	].join("\n");

	it("is refused, and the message names the test phase as what is missing", async () => {
		const result = await validateWrite(NO_TEST_PHASE);

		expect(result.exitCode).not.toBe(0);
		// Naming the rule is not naming the omission. A message that says
		// "structure incomplete" sends the author back to read the spec; one that
		// says "no test phase" tells them what to write.
		expect(result.stderr.toLowerCase()).toMatch(/test phase/);
	}, 30_000);

	it("the same impl without the opt-in is accepted", async () => {
		// The hinge: this is the shape of all 52 existing impls.
		const result = await validateWrite(NO_TEST_PHASE.replace("test_phases: required\n", ""));

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);
});

describe("A2, A3 — an additional test phase must be justified in the first", () => {
	function twoTestPhases(justified: boolean): string {
		return [
			frontmatter(["test_phases: required"]),
			trajectory([
				"| T1 | a thing is true | Test Phase 1 | Build Phase 1 | written |",
				"| T2 | a later thing is true | Test Phase 2 | Build Phase 2 | planned |",
			]),
			"## Checklist",
			"",
			"### Test Phase 1: Author the tests",
			"",
			"- [ ] Author T1 as RED",
			"",
			...(justified
				? [
						"#### Deferred to Test Phase 2",
						"",
						"- **T2** — its subject is a symbol Build Phase 1 introduces, so the",
						"  file cannot load until then.",
						"",
					]
				: []),
			"#### Test Phase 1 Verification",
			"- [ ] T1 is authored and fails on its own assertion",
			"",
			...buildPhase(1, ["T1"]),
			"### Test Phase 2: Author the deferred test",
			"",
			"- [ ] Author T2 as RED",
			"",
			"#### Test Phase 2 Verification",
			"- [ ] T2 is authored and fails on its own assertion",
			"",
			...buildPhase(2, ["T2"]),
		].join("\n");
	}

	it("A2 — an unjustified second test phase is refused, and named", async () => {
		const result = await validateWrite(twoTestPhases(false));

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toMatch(/Test Phase 2/);
	}, 30_000);

	it("A3 — a justified one is accepted", async () => {
		const result = await validateWrite(twoTestPhases(true));

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);
});

describe("A14 — deferrals in Test Phase 1 replace the Trajectory Rationale section", () => {
	const NO_RATIONALE_SECTION = [
		frontmatter(["test_phases: required"]),
		trajectory([
			// `Writable at` later than the default is exactly what the legacy
			// `### Trajectory Rationale` section existed to justify.
			"| T1 | a thing is true | Test Phase 1 | Build Phase 1 | written |",
			"| T2 | a later thing is true | Test Phase 2 | Build Phase 2 | planned |",
		]),
		"## Checklist",
		"",
		"### Test Phase 1: Author the tests",
		"",
		"- [ ] Author T1 as RED",
		"",
		"#### Deferred to Test Phase 2",
		"",
		"- **T2** — its subject is a symbol Build Phase 1 introduces, so the file",
		"  cannot load until then.",
		"",
		"#### Test Phase 1 Verification",
		"- [ ] T1 is authored and fails on its own assertion",
		"",
		...buildPhase(1, ["T1"]),
		"### Test Phase 2: Author the deferred test",
		"",
		"- [ ] Author T2 as RED",
		"",
		"#### Test Phase 2 Verification",
		"- [ ] T2 is authored and fails on its own assertion",
		"",
		...buildPhase(2, ["T2"]),
	].join("\n");

	it("validates with no ### Trajectory Rationale section at all", async () => {
		// Two homes for one fact is the failure this codebase has three lessons
		// about. The register absorbs the section; it does not sit beside it.
		expect(NO_RATIONALE_SECTION).not.toContain("Trajectory Rationale");

		const result = await validateWrite(NO_RATIONALE_SECTION);

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);
});

describe("A8 — a row green on arrival must declare itself a regression guard", () => {
	/**
	 * Green on arrival means the row has no red window: the phase that authors
	 * it is the phase it passes at. That is legitimate — a guard against a
	 * regression, or an assertion about the runner rather than about our code —
	 * and it is also what a rubber stamp looks like. The rule cannot tell them
	 * apart, so it makes the author say which.
	 */
	function greenOnArrival(declared: boolean): string {
		return [
			frontmatter(["test_phases: required"]),
			trajectory(["| T1 | a thing is already true | Test Phase 1 | Test Phase 1 | passing |"]),
			"## Checklist",
			"",
			"### Test Phase 1: Author the tests",
			"",
			"- [ ] Author T1",
			"",
			...(declared
				? [
						"#### Regression Guards",
						"",
						"- **T1** — asserts a fact about the runner, not about our code. It has",
						"  no red phase and should not be given one.",
						"",
					]
				: []),
			"#### Test Phase 1 Verification",
			"- [ ] T1 passes",
			"",
			...buildPhase(1, ["T1"]),
		].join("\n");
	}

	it("an undeclared one is refused, and named", async () => {
		const result = await validateWrite(greenOnArrival(false));

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toMatch(/T1/);
		// The message must name the rule, not merely the row. Without this the
		// case passes today for an unrelated reason — `Test Phase 1` is not a
		// phase reference the trajectory parser understands yet, so the fixture
		// is refused as malformed and the assertion never touches A8's rule.
		expect(result.stderr.toLowerCase()).toMatch(/regression guard/);
	}, 30_000);

	it("a declared one is accepted", async () => {
		const result = await validateWrite(greenOnArrival(true));

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);

	it("A22 — is not demanded of a Test Phase 1 the document does not contain", async () => {
		// The rule fires on the trajectory cells alone, so it can instruct an
		// author to add an entry under a heading that does not exist. Reachable
		// in the mid-conversion state this plan itself passed through: the
		// trajectory already used test-phase cells while the checklist still
		// said `### Phase N`. You cannot be required to declare something in a
		// phase nobody has written — the same reasoning `phaseExists` applies
		// to Gate A, and `test-phase-presence` is the rule that should complain.
		const noTestPhase = [
			frontmatter(),
			trajectory(["| T1 | a thing is already true | Test Phase 1 | Test Phase 1 | passing |"]),
			"## Checklist",
			"",
			...buildPhase(1, ["T1"]),
		].join("\n");

		const result = await validateWrite(noTestPhase);

		expect(result.stderr).not.toMatch(/regression guard/i);
	}, 30_000);
});

describe("A21 — a test phase must carry its Verification gate", () => {
	/**
	 * The four-gate loop deliberately skips test phases: a test phase carries
	 * one gate, not four. Nothing then requires the one — and that gate IS the
	 * U1 compensating control ("Test Phase 1 cannot close until its deferred
	 * bodies have been reviewed"). An author who omits it deletes the review
	 * the plan's only Deferred Verification row rests on, and nothing objects.
	 */
	function testPhase(withVerification: boolean): string {
		return [
			frontmatter(["test_phases: required"]),
			trajectory(["| T1 | a thing is true | Test Phase 1 | Build Phase 1 | written |"]),
			"## Checklist",
			"",
			"### Test Phase 1: Author the tests",
			"",
			"- [ ] Author T1 as RED",
			"",
			...(withVerification
				? [
						"#### Test Phase 1 Verification",
						"- [ ] T1 is authored and fails on its own assertion",
						"",
					]
				: []),
			...buildPhase(1, ["T1"]),
		].join("\n");
	}

	it("one without it is refused, and the phase is named", async () => {
		const result = await validateWrite(testPhase(false));

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toMatch(/Test Phase 1/);
		expect(result.stderr).toMatch(/Verification/);
	}, 30_000);

	it("one with it is accepted", async () => {
		const result = await validateWrite(testPhase(true));

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);
});
