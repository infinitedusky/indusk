// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals
import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	CLAUSES,
	clausePlanProject,
	PLAN,
	PROMISE,
	testOf,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { checkPlanContract } from "./contract.js";

/**
 * a-run-can-be-trusted A40 (second half) and the contract check's call of the two rules: the
 * impl is judged on save only while its status is `draft`. An impl past that is never newly
 * refused for it, and the sweep over every plan (which sets `skipDraft`) leaves a draft alone.
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const impl = (status: string) =>
	implText(PLAN, {
		status,
		keys: ["test_purpose: required"],
		columns: ["For", "Test"],
		rows: CLAUSES.map((c, i) => ({
			id: `A${i + 1}`,
			state: "planned",
			cells: { For: `clause: ${PROMISE}/${c.name}`, Test: testOf(c.name) },
		})),
	});

const messages = (r: ReturnType<typeof checkPlanContract>) =>
	r.ok ? [] : r.refusals.map((x) => x.message);

describe("A40 — which impls are judged for signals", () => {
	it("a draft impl with no signal task is refused, each clause named, with the rule that refused", () => {
		fixture = clausePlanProject();
		const r = checkPlanContract(fixture.planRoot, PLAN, { implText: impl("draft") });
		expect(r.ok).toBe(false);
		const text = messages(r).join("\n");
		expect(text).toContain(`${PROMISE}/a-clause`);
		expect(text).toContain(`${PROMISE}/b-clause`);
		if (!r.ok) expect(r.refusals.some((x) => x.rule === "refused-without-signals")).toBe(true);
	});

	it.each(["approved", "in-progress", "completed"])(
		"an impl already %s is not refused for its signals",
		(status) => {
			fixture = clausePlanProject();
			const r = checkPlanContract(fixture.planRoot, PLAN, { implText: impl(status) });
			expect(messages(r).join("\n")).not.toMatch(/signal/);
		},
	);

	it("the sweep over every plan (skipDraft) leaves a draft impl alone", () => {
		fixture = clausePlanProject();
		const r = checkPlanContract(fixture.planRoot, PLAN, {
			implText: impl("draft"),
			skipDraft: true,
		});
		expect(messages(r).join("\n")).not.toMatch(/signal/);
	});

	it("only the signal rules are asked when clauseSignalsOnly is set, whatever else the contract holds", () => {
		fixture = clausePlanProject();
		const r = checkPlanContract(fixture.planRoot, PLAN, {
			implText: impl("draft"),
			clauseSignalsOnly: true,
		});
		expect(r.ok).toBe(false);
		expect(messages(r).every((m) => /signal|runs only after landing/.test(m))).toBe(true);
	});
});
