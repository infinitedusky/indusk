import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { filesMatching } from "../structural.test-support.js";
import { gateTransition, validateWrite } from "./helpers/hook-runner.js";

/**
 * A13, A17 — the phase heading gets one definition, and "no phases" becomes a
 * refusal.
 *
 * These two belong together because the second is what makes the first safe to
 * do. Changing what a heading looks like across seven copies is risky; changing
 * it in one place while "nothing parsed" silently passes is worse, because a
 * typo in the new syntax would disable every structural rule at once instead of
 * failing loudly.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("A13 — one definition of the phase heading", () => {
	it("is defined exactly once across src/", async () => {
		// Seven copies across six files originally: impl-parser.ts, check-gates.js,
		// gate-reminder.js, validate-impl-structure.js (x2), trajectory/validator.ts
		// and shape/impl-blocks.ts. The JS hooks are deliberate ports and live
		// outside src/, so this scan covers src/ only — the same carve-out the
		// verify suite makes for its hook mirrors.
		//
		// Two spellings, because a literal-only scan has a false negative and it
		// cost us one: `shape/impl-blocks.ts` built its matcher with
		// `new RegExp(\`^###\\\\s+Phase...\`)`, where the source text carries a
		// DOUBLE backslash. The single-backslash pattern skipped straight past
		// it, the guard reported one definition, and the copy stayed — matching
		// `### Phase N` only, so Shape found no phase at all in impls written
		// the new way. A guard with a false negative is worth less than no
		// guard, because it is believed.
		const literal = await filesMatching(srcDir, /###\\s\+\(\?:Build|###\\s\+Phase/);
		const templated = await filesMatching(srcDir, /###\\\\s\+\(\?:Build|###\\\\s\+Phase/);
		const definitions = [...new Set([...literal, ...templated])];

		expect(definitions).toHaveLength(1);
	});

	// Authored in Build Phase 1 rather than with the rest of the trajectory,
	// and justified in Test Phase 1's register: it imports the module Build
	// Phase 1 creates, so at Test Phase 1 it would have failed to *load* — the
	// assertion never running, a red that says nothing about behaviour. This is
	// the legitimate `Writable at = Passes at` case, where the subject is a
	// symbol introduced in the same phase.
	it("the one definition accepts both spellings and rejects a test phase", async () => {
		// Guards the guard. A single definition that quietly matched `Test Phase`
		// as well would collapse the distinction this plan exists to create, and
		// it would do so silently: every test phase would satisfy the build-phase
		// rules and nothing would report a problem.
		const { PHASE_HEADING, TEST_PHASE_HEADING } = await import("../lib/impl-headings.js");

		expect("### Phase 1: Thing").toMatch(PHASE_HEADING);
		expect("### Build Phase 1: Thing").toMatch(PHASE_HEADING);
		expect("### Test Phase 1: Thing").not.toMatch(PHASE_HEADING);
		expect("### Test Phase 1: Thing").toMatch(TEST_PHASE_HEADING);
	});
});

describe("A17 — an impl in which no phase parses is refused, not passed", () => {
	// The hazard is not a malformed file sitting on disk; it is a malformed file
	// arriving as an *edit that checks a box*. Every structural rule is keyed on
	// parsed phases, so when zero phases parse there is nothing to enforce
	// against and the write sails through — the typo does not fail, it disables.
	// `Bulid` is the plausible version of that typo under this plan's new syntax.
	const FRONTMATTER = [
		"---",
		'title: "Broken"',
		"status: in-progress",
		"trajectory: required",
		"gate_policy: auto",
		"---",
		"",
		"# Broken",
		"",
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State |",
		"|----|---------|-------------|-----------|-------|",
		"| T1 | a thing is true | Phase 0 | Phase 1 | passing |",
		"",
		"## Checklist",
		"",
	].join("\n");

	const VALID_ON_DISK = `${FRONTMATTER}${[
		"### Phase 1: Thing",
		"",
		"- [ ] do the thing",
		"",
		"#### Phase 1 Verification",
		"- [ ] T1 passes",
		"",
	].join("\n")}`;

	const TYPO_WITH_CHECKOFF = `${FRONTMATTER}${[
		"### Bulid Phase 1: Thing",
		"",
		"- [x] do the thing",
		"",
		"#### Phase 1 Verification",
		"- [ ] T1 passes",
		"",
	].join("\n")}`;

	it("validate-impl-structure refuses it", async () => {
		const result = await validateWrite(TYPO_WITH_CHECKOFF);

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toLowerCase()).toMatch(/phase/);
	}, 30_000);

	it("check-gates refuses it", async () => {
		const result = await gateTransition(VALID_ON_DISK, TYPO_WITH_CHECKOFF);

		expect(result.exitCode).not.toBe(0);
	}, 30_000);
});
