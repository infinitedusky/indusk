// promise: a-change-to-what-was-agreed-needs-the-person
// promise: only-a-person-reapproves
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDue, readQuestionWait } from "./deadline.js";
import type { Change, Question } from "./record.js";
import { sweep } from "./sweep.js";

/**
 * decisions-as-questions T17: a timer never approves a brief, a test plan, a look or an
 * ADR. A question whose option changes one is never due however long it waits or however
 * the costs are set, the sweep only ever picks the recommended option on the record, and
 * nothing in the questions folder writes an approval.
 */
const q = (changes: Change[]): Question => ({
	id: "q",
	plan: "p",
	text: "t",
	options: [
		{ label: "a", changes },
		{ label: "b", changes: [] },
	],
	recommended: "a",
	reason: "r",
	statedCost: "cheap",
	cost: "cheap",
	askedAt: 0,
	state: "waiting",
});

describe("T17 — no timer approves what was agreed", () => {
	it.each(["brief", "promise", "look", "gate"] as const)(
		"a question changing the %s never goes ahead",
		(what) => {
			for (const v of ["immediate", 1] as const) {
				const all = readQuestionWait({ cheap: v, moderate: v, expensive: v });
				expect(isDue(q([what]), Number.MAX_SAFE_INTEGER, all)).toBe(false);
				const out = sweep([q([what])], Number.MAX_SAFE_INTEGER, all, () => {
					throw new Error("sent a question that changes what was agreed");
				});
				expect(out[0]?.state).toBe("waiting");
			}
		},
	);

	it("the questions folder never writes an approval", () => {
		const dir = new URL(".", import.meta.url).pathname;
		for (const file of ["follow-on.ts", "sweep.ts", "answer.ts", "ask.ts"]) {
			const text = readFileSync(join(dir, file), "utf-8");
			expect(text, file).not.toMatch(/approved_brief|approved_by|approvePlan|acceptPlan|approve\(/);
		}
	});
});
