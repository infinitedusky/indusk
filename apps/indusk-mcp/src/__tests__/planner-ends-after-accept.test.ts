// clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance
// promise: an-accepted-brief-is-planned-unasked

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * a-brief-is-planned-unasked T20 (A20): the planner skill tells a planning
 * conversation to end after accepting its brief, leaving the documents to the
 * unattended run, which starts when the conversation ends. A person can still
 * ask to plan by hand. Reads the package-owned skill (the installed copy is
 * pinned byte-equal by skill-sync-parity).
 */

const skill = readFileSync(join(__dirname, "..", "..", "skills", "planner.md"), "utf-8");
const acceptStep = skill.slice(
	skill.indexOf("indusk plans accept-brief {plan-name}"),
	skill.indexOf("**If the person later drops or renames"),
);

describe("A20 — the planner ends the conversation after accepting the brief", () => {
	it("A20 says the run starts when this conversation ends", () => {
		expect(acceptStep).toMatch(/starts? (when|once|as soon as) (this|the) conversation ends/i);
	});

	it("A20 tells the conversation to end after accepting and write none of the documents", () => {
		expect(acceptStep).toMatch(/end (this|the) conversation/i);
		expect(acceptStep).toMatch(/write none of them/i);
	});

	it("A20 no longer sends a held-back run to be written in the conversation", () => {
		expect(acceptStep).not.toMatch(/the plan is written here, from step 5/i);
	});

	it("A20 keeps planning by hand available when the person asks for it", () => {
		expect(acceptStep).toMatch(/by hand/i);
	});
});
