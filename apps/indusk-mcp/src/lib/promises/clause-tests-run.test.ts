import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	failingRun,
	PLAN,
	PROMISE,
	passingRun,
	registryState,
	testOf,
	upheldSignals,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { confirmPlan } from "./confirm.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/verified-before-release

/**
 * A1 and A3 of mark-first: closing a plan written as clauses runs the tests
 * its clause rows name, through a runner handed in, and refuses a clause whose
 * test fails now, though its row says passing. The refusal names
 * `promise/clause` and the file, and a failing file is reported against the
 * clause it names, not its neighbours.
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const messages = (r: Awaited<ReturnType<typeof confirmPlan>>) =>
	r.ok ? [] : r.refusals.map((x) => x.message);

describe("closing runs the clause's tests", () => {
	it("A1 — a row that says passing is refused when its test fails now, naming the clause and the file", async () => {
		fixture = clausePlanProject();
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			runTests: failingRun(testOf("a-clause")),
			readSignals: upheldSignals(),
		});
		expect(r.ok, "closing accepted a clause whose test fails now").toBe(false);
		const text = messages(r).join("\n");
		expect(text).toMatch(/a-promise\/a-clause/);
		expect(text).toMatch(/src\/a-clause\.test\.ts/);
		expect(text, "the refusal says the tests half is missing").toMatch(/tests/);
		expect(registryState(fixture, PROMISE), "a refused close writes nothing").toBe("declared");
	});

	it("A1 — the tests run are the files the clause rows name, and all passing closes", async () => {
		fixture = clausePlanProject();
		const asked: string[][] = [];
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			runTests: passingRun(asked),
			readSignals: upheldSignals(),
		});
		expect(messages(r)).toEqual([]);
		expect(asked.flat().sort()).toEqual([testOf("a-clause"), testOf("b-clause")].sort());
	});

	it("A1 — a file the runner never reported counts as failing, never as passed", async () => {
		fixture = clausePlanProject();
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			runTests: async () => [],
			readSignals: upheldSignals(),
		});
		expect(r.ok).toBe(false);
		expect(messages(r).join("\n")).toMatch(/a-promise\/a-clause/);
	});

	it("A3 — a failing test is reported against the clause its file names", async () => {
		fixture = clausePlanProject();
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			runTests: failingRun(testOf("b-clause")),
			readSignals: upheldSignals(),
		});
		expect(r.ok).toBe(false);
		const text = messages(r).join("\n");
		expect(text).toMatch(
			/a-promise\/b-clause.*src\/b-clause\.test\.ts|src\/b-clause\.test\.ts.*a-promise\/b-clause/,
		);
		expect(text, "the passing clause is not blamed").not.toMatch(/a-promise\/a-clause/);
	});
});
