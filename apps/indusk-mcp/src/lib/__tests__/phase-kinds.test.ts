import { describe, expect, it } from "vitest";
import { check, gateTransition, validateWrite } from "../../__tests__/helpers/hook-runner.js";

/**
 * A5, A16 — the two phase kinds.
 *
 * A5 is the backward-compatibility claim: `### Phase 1` and `### Build Phase 1`
 * are the same thing said two ways. A16 is the deferral-body claim: Test Phase
 * 1 may carry a deferred test as a code block, and the block is inert.
 *
 * Both drive the hooks as black boxes. Nothing here imports a symbol this plan
 * creates, so nothing here is a compile error today — they fail because today's
 * parser recognises exactly one of the two spellings.
 */

// Deliberately no `rationale: required`. These fixtures are about phase kinds
// and inert deferral bodies; opting into the legacy `### Trajectory Rationale`
// rule would make them fail on a claim they do not make — that the register
// absorbs that section, which is A14's, tested directly there.
const FRONTMATTER = [
	"---",
	'title: "Fixture"',
	"status: in-progress",
	"trajectory: required",
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

describe("A5 — `### Phase 1` and `### Build Phase 1` behave identically", () => {
	/**
	 * A phase whose Verification gate is absent. The validator must refuse it.
	 *
	 * The fixture is deliberately *invalid*: two spellings both being accepted
	 * proves nothing, because today the `Build ` spelling is accepted by being
	 * invisible. Only a rule that must fire distinguishes "understood" from
	 * "not seen".
	 */
	function missingGate(heading: string): string {
		return [
			FRONTMATTER,
			trajectory(["| T1 | a thing is true | Phase 0 | Phase 1 | passing |"]),
			"## Checklist",
			"",
			heading,
			"",
			"- [ ] do the thing",
			"",
			"#### Phase 1 Context",
			"- [ ] (none needed)",
			"",
			"#### Phase 1 Document",
			"- [ ] (none needed)",
			"",
		].join("\n");
	}

	it("the validator refuses a missing gate under either spelling", async () => {
		const plain = await validateWrite(missingGate("### Phase 1: Thing"));
		const prefixed = await validateWrite(missingGate("### Build Phase 1: Thing"));

		expect(plain.exitCode).not.toBe(0);
		expect({ plain: plain.exitCode, prefixed: prefixed.exitCode }).toEqual({
			plain: plain.exitCode,
			prefixed: plain.exitCode,
		});
	}, 60_000);

	/**
	 * Gate A's own fixture: a row writable at the phase being advanced, still
	 * unauthored. Checking off implementation work must be refused under either
	 * spelling — the gate hook and the validator parse headings separately, so
	 * a fix in one is not evidence about the other.
	 */
	function unauthoredRow(heading: string): string {
		return [
			FRONTMATTER,
			trajectory(["| T1 | a thing is true | Phase 1 | Phase 1 | planned |"]),
			"## Checklist",
			"",
			heading,
			"",
			"- [ ] do the thing",
			"",
			"#### Phase 1 Verification",
			"- [ ] T1 passes",
			"",
			"#### Phase 1 Context",
			"- [ ] (none needed)",
			"",
			"#### Phase 1 Document",
			"- [ ] (none needed)",
			"",
		].join("\n");
	}

	it("the gate hook refuses an unauthored test under either spelling", async () => {
		const plainBefore = unauthoredRow("### Phase 1: Thing");
		const prefixedBefore = unauthoredRow("### Build Phase 1: Thing");

		const plain = await gateTransition(plainBefore, check(plainBefore, "do the thing"));
		const prefixed = await gateTransition(prefixedBefore, check(prefixedBefore, "do the thing"));

		expect(plain.exitCode).toBe(2);
		expect(prefixed.exitCode).toBe(2);
	}, 60_000);
});

describe("A16 — a deferral may carry the deferred test's body", () => {
	/**
	 * Test Phase 1 as the register, with a deferral whose body is a fenced code
	 * block. The block contains the two things most likely to be misread as
	 * structure — a checkbox line and a gate heading — because a parser that
	 * scans line-by-line without tracking fences would pick up both.
	 */
	function withDeferralBody(verificationChecked: boolean): string {
		return [
			FRONTMATTER,
			trajectory([
				"| T1 | a thing is true | Test Phase 1 | Build Phase 1 | written |",
				"| T2 | a later thing is true | Test Phase 2 | Build Phase 2 | planned |",
			]),
			"## Checklist",
			"",
			"### Test Phase 1: Author the tests",
			"",
			"- [x] Author T1 as RED",
			"",
			"#### Deferred to Test Phase 2",
			"",
			"- **T2** — its subject is a symbol Build Phase 1 introduces, so the file",
			"  cannot load today. Body reviewed and carried here:",
			"",
			"  ```typescript",
			'  import { thing } from "./thing.js";',
			"",
			'  it("does the later thing", () => {',
			"    expect(thing()).toBe(true);",
			"  });",
			"",
			"  // - [ ] this line is inside a fence and is not a checklist item",
			"  // #### Test Phase 1 Verification",
			"  // - [ ] neither is this",
			"  ```",
			"",
			"#### Test Phase 1 Verification",
			`- [${verificationChecked ? "x" : " "}] T1 is authored and fails on its own assertion`,
			"",
			"### Build Phase 1: Build the thing",
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
	}

	it("the validator accepts it", async () => {
		const result = await validateWrite(withDeferralBody(true));

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);

	it("the phases around it are really parsed, not merely unseen", async () => {
		// This is the case that carries the red. "Accepted" is ambiguous while
		// `### Test Phase 1` parses as nothing at all — an impl the parser cannot
		// see is accepted for the same reason an empty one is. So assert that a
		// genuine violation in the same document IS caught: Test Phase 1's
		// Verification left unchecked must block Build Phase 1's first item.
		const before = withDeferralBody(false);
		const result = await gateTransition(before, check(before, "do the thing"));

		expect(result.exitCode).toBe(2);
		expect(result.stderr).toMatch(/Verification/i);
	}, 30_000);

	it("the fenced checkbox is not what blocks", async () => {
		// The mirror of the case above: with every real gate satisfied, the only
		// unchecked box in Test Phase 1 is the one inside the code fence. If that
		// counted, this transition would be refused and the deferral shape would
		// be unusable in practice.
		const before = withDeferralBody(true);
		const result = await gateTransition(before, check(before, "do the thing"));

		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	}, 30_000);
});
