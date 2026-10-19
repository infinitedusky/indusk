import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	failingRun,
	PLAN,
	passingRun,
	testOf,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { refuseFailingClauseTests } from "./land.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/verified-before-release

/**
 * A2 of mark-first: landing runs the same tests closing does, through the same
 * injected runner, and refuses by clause. Landing asks no signal (the plan's
 * decision D-8: "before release" is the tests half). A plan written before
 * clause plans lands as before, with no clause test run asked of it.
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

describe("A2 — landing refuses a clause whose test fails", () => {
	it("refuses, naming the clause and the file", async () => {
		fixture = clausePlanProject();
		await expect(
			refuseFailingClauseTests(
				fixture.planRoot,
				fixture.codeRoot,
				PLAN,
				failingRun(testOf("b-clause")),
			),
		).rejects.toThrow(/a-promise\/b-clause[\s\S]*src\/b-clause\.test\.ts/);
	});

	it("lands when every clause's tests pass", async () => {
		fixture = clausePlanProject();
		const asked: string[][] = [];
		await expect(
			refuseFailingClauseTests(fixture.planRoot, fixture.codeRoot, PLAN, passingRun(asked)),
		).resolves.toBeUndefined();
		expect(asked.flat().sort()).toEqual([testOf("a-clause"), testOf("b-clause")].sort());
	});

	it("a plan written before clause plans runs no clause tests at landing", async () => {
		fixture = clausePlanProject({ legacy: true });
		const asked: string[][] = [];
		await refuseFailingClauseTests(fixture.planRoot, fixture.codeRoot, PLAN, passingRun(asked));
		expect(asked).toEqual([]);
	});
});
