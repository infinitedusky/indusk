// promise: a-plan-is-read-cold-before-approval
/**
 * promise: an-audit-concern-gets-a-solution — A2, A4, A10, A13, A25, A26.
 */
import { describe, expect, it } from "vitest";
import {
	AUDIT_QUESTIONS,
	describeAnswers,
	PLAN_REVIEW_QUESTIONS,
	readAuditAnswers,
} from "./answers.js";

/**
 * clause: an-audit-concern-gets-a-solution/the-audit-finds — A2
 * clause: an-audit-concern-gets-a-solution/the-plan-answers — A4
 * clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person — A5 (the reader's half)
 * clause: an-audit-concern-gets-a-solution/an-audit-teaches — A10
 * clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person — A13
 * clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan — A17
 */

const audit = (body: string) =>
	`---\nplan: p\n---\n\n# Audit — p\n\n## What does the diff change that no row touches?\n${body}\n`;

describe("readAuditAnswers", () => {
	it("A2 — a finding with no breaks-when line is incomplete", () => {
		const r = readAuditAnswers(audit("- `a.ts:3` — x\n  - answer: nothing — fine"));
		expect(r.incomplete.map((f) => f.line)).toEqual([8]);
	});
	it("A4 — an unanswered finding, or a signal with no clause, is refused", () => {
		const r = readAuditAnswers(
			audit(
				"- `a.ts:3` — x\n  - breaks when: y\n- `b.ts:1` — z\n  - breaks when: w\n  - answer: signal — inv; here; daily",
			),
		);
		expect(r.unanswered.length + r.noClause.length).toBe(2);
	});
	it("A4 — a signal naming its clause, and a fully answered audit, pass", () => {
		const r = readAuditAnswers(
			audit(
				"- `a.ts:3` — x\n  - breaks when: y\n  - answer: signal — inv; here; daily; clause: a-p/a-c\n\n## What let these through?\n- no process gap — one-off",
			),
		);
		expect(r.unanswered).toEqual([]);
		expect(r.noClause).toEqual([]);
		expect(r.missingCauses).toBe(false);
	});
	it("A5 — every nothing answer is listed with its reason", () => {
		const r = readAuditAnswers(
			audit("- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing — too unlikely"),
		);
		expect(r.dismissals).toEqual([expect.objectContaining({ reason: "too unlikely" })]);
	});
	it("A13 — an amendment answer is an answer, listed beside the dismissals", () => {
		const r = readAuditAnswers(
			audit("- `a.ts:3` — x\n  - breaks when: y\n  - answer: amendment — promise a-x narrowed"),
		);
		expect(r.unanswered).toEqual([]);
		expect(r.amendments).toEqual([expect.objectContaining({ part: "promise a-x narrowed" })]);
	});
	it("A10 — findings with no causes section are incomplete; a no-gap line passes", () => {
		const body = "- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing — fine";
		expect(readAuditAnswers(audit(body)).missingCauses).toBe(true);
		expect(
			readAuditAnswers(`${audit(body)}\n## What let these through?\n- no process gap — one-off\n`)
				.missingCauses,
		).toBe(false);
	});
	it("A17 — a plan review missing one of its four questions is incomplete, naming it", () => {
		const all = PLAN_REVIEW_QUESTIONS.map((q) => `## ${q}\n- nothing\n`).join("\n");
		expect(readAuditAnswers(all, { questions: PLAN_REVIEW_QUESTIONS }).missingQuestions).toEqual(
			[],
		);
		const three = PLAN_REVIEW_QUESTIONS.slice(1)
			.map((q) => `## ${q}\n- nothing\n`)
			.join("\n");
		expect(readAuditAnswers(three, { questions: PLAN_REVIEW_QUESTIONS }).missingQuestions).toEqual([
			PLAN_REVIEW_QUESTIONS[0],
		]);
		expect(AUDIT_QUESTIONS).toHaveLength(4);
	});
});

describe("readAuditAnswers — what a real reader writes", () => {
	it("A24 — a fenced diff under a finding is not read as findings or headings", () => {
		const r = readAuditAnswers(
			audit(
				"- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing — fine\n\n```diff\n- old\n## Heading\n```",
			),
		);
		expect(r.findings).toHaveLength(1);
		expect(r.unanswered).toEqual([]);
		expect(r.missingQuestions).toHaveLength(3);
	});
	it("A25 — an answer with nothing after its kind is no answer", () => {
		const r = readAuditAnswers(audit("- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing"));
		expect(r.unanswered).toHaveLength(1);
		expect(r.dismissals).toEqual([]);
	});
	it("A26 — a signal's clause must be one the registry holds, when it is handed in", () => {
		const body = (c: string) =>
			audit(
				`- \`a.ts:3\` — x\n  - breaks when: y\n  - answer: signal — inv; here; daily; clause: ${c}`,
			);
		const clauses = new Set(["a-x/holds"]);
		expect(readAuditAnswers(body("a-x/holds"), { clauses }).noClause).toEqual([]);
		expect(readAuditAnswers(body("a-x/nope"), { clauses }).noClause).toHaveLength(1);
		expect(readAuditAnswers(body("<promise>/<clause>"), { clauses }).noClause).toHaveLength(1);
		expect(readAuditAnswers(body("a-x/nope")).noClause).toEqual([]);
	});
	it("A27 — Nothing, None and a trailing full stop all mark a question empty", () => {
		for (const w of ["Nothing.", "None", "none.", "NOTHING"]) {
			expect(readAuditAnswers(audit(`- ${w}`)).findings).toEqual([]);
		}
	});
});

describe("describeAnswers", () => {
	it("names what is open, and lists dismissals and amendments for the person", () => {
		const r = readAuditAnswers(
			audit(
				"- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing — too unlikely\n- `b.ts:1` — z\n  - breaks when: w\n  - answer: amendment — promise a-x narrowed\n- `c.ts:2` — v\n  - breaks when: u",
			),
		);
		const { open, shown } = describeAnswers(r, "audit.md");
		expect(open.some((l) => l.includes("has no answer") && l.includes("c.ts:2"))).toBe(true);
		expect(shown).toEqual([
			"What does the diff change that no row touches? — `a.ts:3` — x — nothing: too unlikely",
			"What does the diff change that no row touches? — `b.ts:1` — z — amendment: promise a-x narrowed",
		]);
	});
});
