import { describe, expect, it } from "vitest";
import { validateWrite } from "../../__tests__/helpers/hook-runner.js";
import { fencedLineMask, phaseSequence } from "../impl-headings.js";

/**
 * A18, A19 — the fence mask is load-bearing structure now.
 *
 * Before this plan, an impl was prose and the occasional example. Now a
 * deferral in Test Phase 1 *carries the deferred test's body*, so impls hold
 * arbitrary code — frequently, in this repo, markdown about markdown. The mask
 * that keeps that body inert was written in one commit and assumes every fence
 * is balanced and that all fence markers are interchangeable. Neither holds.
 *
 * Both cases were reproduced against the shipped code during falsification
 * rather than predicted.
 */

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
	"## Test Trajectory",
	"",
	"| ID | Asserts | Writable at | Passes at | State |",
	"|----|---------|-------------|-----------|-------|",
	"| T1 | a thing is true | Test Phase 1 | Build Phase 1 | written |",
	"",
	"## Checklist",
	"",
].join("\n");

describe("A18 — an unterminated fence must not delete the rest of the document", () => {
	/**
	 * The opening fence is never closed, so every line after it is masked. The
	 * phases below it stop existing as far as every parser is concerned — and
	 * the zero-phase rejection cannot save it, because one phase did parse.
	 */
	const UNTERMINATED = [
		FRONTMATTER,
		"### Test Phase 1: Author the tests",
		"",
		"- [x] Author T1 as RED",
		"",
		"#### Deferred to Build Phase 1",
		"",
		"- **T2** — body carried here:",
		"",
		"  ```typescript",
		"  const x = 1;",
		"",
		"#### Test Phase 1 Verification",
		"- [x] T1 is authored",
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

	it("does not swallow the phases below it", () => {
		// The mask must fail OPEN: an opener with no closer is not a fence, so
		// the document keeps its structure. Today it returns ["test:1"] — Build
		// Phase 1 has ceased to exist, and every rule keyed on phases silently
		// has nothing to say about it.
		expect(phaseSequence(UNTERMINATED).map((p) => `${p.kind}:${p.number}`)).toEqual([
			"test:1",
			"build:1",
		]);
	});

	it("is refused, and the message names the unterminated fence", async () => {
		// Failing open keeps the parsers honest but produces confusing errors —
		// the body's contents leak into structure. So the validator ALSO
		// refuses, naming the real problem. Neither half suffices: refusing
		// alone leaves `check-gates`, which has no such rule, reading a
		// truncated document.
		const result = await validateWrite(UNTERMINATED);

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toLowerCase()).toMatch(/fence|code block/);
	}, 30_000);
});

describe("A19 — a fence closes only on its own marker", () => {
	/**
	 * A backtick-fenced body containing a tilde fence — an ordinary shape for a
	 * carried test that documents markdown. The mask treats the markers as
	 * interchangeable, so the tilde ends the block early and everything after
	 * it inside the body is read as structure.
	 */
	const lines = [
		"### Test Phase 1: Author the tests",
		"",
		"#### Deferred to Build Phase 1",
		"",
		"- **T2** — body carried here:",
		"",
		"  ```markdown",
		"  A tilde fence inside the sample:",
		"  ~~~",
		"  - [ ] not a real item",
		"  ~~~",
		"  ```",
		"",
		"#### Test Phase 1 Verification",
		"- [x] T1 is authored",
		"",
	];

	it("leaves a checklist item inside a carried body inert", () => {
		const mask = fencedLineMask(lines);
		const leaked = lines.filter((l, i) => !mask[i] && l.includes("not a real item"));

		expect(leaked).toEqual([]);
	});

	it("and the phases around the body still parse", () => {
		// The mirror: over-masking would be its own bug. A fence rule that fixed
		// the leak by swallowing the document would satisfy the case above and
		// reintroduce A18.
		expect(phaseSequence(lines.join("\n")).map((p) => `${p.kind}:${p.number}`)).toEqual([
			"test:1",
		]);
	});
});
