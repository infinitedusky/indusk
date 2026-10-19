import { describe, expect, it } from "vitest";
import { captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import { readAuditAnswers } from "./answers.js";
import { markAuditAnswers } from "./answers-signal.js";

// promise: an-audit-concern-gets-a-solution
// clause: an-audit-concern-gets-a-solution/the-audit-finds
// clause: an-audit-concern-gets-a-solution/the-plan-answers
// clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person
// clause: an-audit-concern-gets-a-solution/an-audit-teaches

/** A28: reading an audit's answers writes one signal per audit clause. */

const complete = `## Does each row prove its promise's sentence, or something narrower?
- a row proves less
  - breaks when: the row is deleted
  - answer: nothing — covered by a lint rule

## What does the diff change that no row touches?
nothing.

## What does the code do that the brief never promised?
nothing.

## Which rejected ADR alternative does the code quietly take?
nothing.

## What let these through?
- no process gap — the finding was one-off
`;

describe("A28 — reading an audit's answers reports each audit clause", () => {
	it("upholds all four when the audit is complete and its dismissals were printed", async () => {
		const { tracer, spans } = captureTracer();
		await markAuditAnswers("/nowhere", "p", readAuditAnswers(complete), true, tracer);
		expect(outcomesByClause(spans)).toEqual({
			"the-audit-finds": "upheld",
			"the-plan-answers": "upheld",
			"a-dismissal-reaches-the-person": "upheld",
			"an-audit-teaches": "upheld",
		});
		expect(
			spans.every((s) => s.attrs["indusk.promise"] === "an-audit-concern-gets-a-solution"),
		).toBe(true);
	});

	it("breaks the-audit-finds naming a finding with no breaks-when line", async () => {
		const { tracer, spans } = captureTracer();
		const text = complete.replace("  - breaks when: the row is deleted\n", "");
		await markAuditAnswers("/nowhere", "p", readAuditAnswers(text), false, tracer);
		const out = outcomesByClause(spans);
		expect(out["the-audit-finds"]).toBe("broken");
		const broken = spans.find((s) => s.attrs["indusk.clause"] === "the-audit-finds");
		expect(String(broken?.events[0].attrs?.["indusk.promise.symptom"])).toContain(
			"a row proves less",
		);
	});

	it("breaks the-plan-answers for an unanswered finding, a-dismissal when not printed, and teaches without causes", async () => {
		const { tracer, spans } = captureTracer();
		const text = complete
			.replace("  - answer: nothing — covered by a lint rule\n", "")
			.replace("## What let these through?\n- no process gap — the finding was one-off\n", "");
		await markAuditAnswers("/nowhere", "p", readAuditAnswers(text), false, tracer);
		expect(outcomesByClause(spans)).toMatchObject({
			"the-plan-answers": "broken",
			"an-audit-teaches": "broken",
		});
	});

	it("breaks a-dismissal-reaches-the-person when a dismissal exists and was not printed", async () => {
		const { tracer, spans } = captureTracer();
		await markAuditAnswers("/nowhere", "p", readAuditAnswers(complete), false, tracer);
		expect(outcomesByClause(spans)["a-dismissal-reaches-the-person"]).toBe("broken");
	});
});
