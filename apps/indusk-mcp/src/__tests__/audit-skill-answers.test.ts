// promise: a-plan-is-read-cold-before-approval
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Prose has no other test, so this reads the audit, planner, falsify, cleanup and
 * retrospective skills as text, like planner-impl-summary-template.test.ts.
 *
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes — A15.
 * promise: an-audit-concern-gets-a-solution — A1, A3, A5, A9, A11.
 * clause: an-audit-concern-gets-a-solution/the-audit-finds — A1
 * clause: an-audit-concern-gets-a-solution/the-plan-answers — A3
 * clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person — A5
 * clause: an-audit-concern-gets-a-solution/an-audit-teaches — A9
 * clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person — A11
 * clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan — A16
 * clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval — A19
 */

const PKG = resolve(__dirname, "../..");
const skill = (name: string) => readFileSync(join(PKG, "skills", `${name}.md`), "utf-8");
const audit = skill("audit");
const planner = skill("planner");

/** The four questions of the plan review, pinned here; the reader's exported list must match. */
const PLAN_REVIEW_QUESTIONS = [
	"Do the planned tests prove each promise's sentence, or something narrower?",
	"Does the impl build what each promise claims, and nothing it does not?",
	"Which skip reason would you not accept?",
	"What else would have to change for each promise to hold?",
];

describe("A1 — the reader writes what would show a finding breaking, and no remedy", () => {
	it("asks for a breaks-when line under each finding", () => {
		expect(audit).toContain("- breaks when:");
	});
	it("tells the reader to suggest no remedy", () => {
		expect(audit).toMatch(/no remedy|suggest no (fix|remedy)|never suggest a (fix|remedy)/i);
	});
});

describe("A3 — the plan's agent answers every finding", () => {
	it("names the answer kinds fix, signal and nothing", () => {
		expect(audit).toContain("- answer: fix —");
		expect(audit).toMatch(/- answer: signal — .*clause: <promise>\/<clause>/);
		expect(audit).toContain("- answer: nothing —");
	});
});

describe("A5 — the dismissals are shown to the person", () => {
	it("runs the answers command and shows the dismissals", () => {
		expect(audit).toContain("indusk plans audit-answers {plan}");
		expect(audit).toMatch(/dismissal/i);
	});
});

describe("A9 — the agent asks once what let the findings through", () => {
	it("groups by cause, flags a recurring gap for a lesson, or says there is none", () => {
		expect(audit).toContain("mcp__indusk__highlight");
		expect(audit).toContain("audit-cause");
		expect(audit).toContain("## What let these through?");
		expect(audit).toContain("- no process gap —");
	});
});

describe("A11 — an answer that changes the brief is an amendment, and the session stops", () => {
	it("records it as an amendment answer and ends the session", () => {
		expect(audit).toContain("- answer: amendment —");
		expect(audit).toMatch(/promise, an expectation, a look|promise, expectation, look/i);
		expect(audit).toMatch(/session (ends|stops)|end the session|stop the session/i);
	});
	it("answers every other concern without asking", () => {
		expect(audit).toMatch(/without asking/i);
	});
});

describe("A15 — the order is build, audit, falsify, cleanup, retrospective", () => {
	const ORDER =
		"`/work` → `/audit` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`";
	it.each(["audit", "falsify", "cleanup", "retrospective"])("%s gives the order", (name) => {
		expect(skill(name)).toContain(ORDER);
	});
	it.each(["audit", "falsify", "cleanup", "retrospective"])("%s gives no other order", (name) => {
		expect(skill(name)).not.toMatch(
			/`\/work` → `\/falsify` → `\/work` → `\/cleanup` → `\/work` → `\/audit`/,
		);
		expect(skill(name)).not.toMatch(/\/work → \/falsify → \/work → \/cleanup → \/work → \/audit/);
	});
});

describe("A16 — the before-approval mode puts the four plan questions to the reader", () => {
	const section = audit.slice(audit.search(/Before approval/));
	it("has a before-approval section", () => {
		expect(audit).toMatch(/Before approval/);
	});
	it.each(PLAN_REVIEW_QUESTIONS)("contains %s", (q) => {
		expect(section).toContain(q);
	});
});

describe("A19 — the plan review is answered before approval and the planner runs it", () => {
	const section = audit.slice(audit.search(/Before approval/));
	it("the audit's before-approval mode names the planning agent's answers and shows the dismissals", () => {
		expect(section).toContain("fix — <document changed>");
		expect(section).toContain("amendment —");
		expect(section).toContain("nothing —");
		expect(section).toMatch(/dismissal/i);
	});
	it("the planner runs the plan review before presenting a plan written by hand", () => {
		expect(planner).toContain("/audit {plan} --before-approval");
	});
});

describe("A43 — the reader runs in the foreground and the turn waits for it", () => {
	const afterApproval = audit.slice(audit.indexOf("3. **Spawn the reader.**"), audit.search(/Before approval/));
	const beforeApproval = audit.slice(audit.search(/## Before approval/));
	it.each([
		["the post-build audit", afterApproval],
		["the plan review", beforeApproval],
	])("%s says run_in_background: false and never to end the turn while the reader runs", (_n, text) => {
		expect(text).toContain("run_in_background: false");
		expect(text).toMatch(/never end (your|the) turn while the reader runs/i);
	});
});
