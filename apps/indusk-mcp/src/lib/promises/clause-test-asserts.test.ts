import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	clauseTestFile,
	PLAN,
	passingRun,
	upheldSignals,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { confirmPlan } from "./confirm.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/verified-before-release

/**
 * A29 of mark-first: a test file that carries a clause's token and asserts
 * nothing does not prove the clause, and closing refuses it. The rule is the
 * plan's decision D-3, its narrowest form: the file holds at least one
 * `expect(` or `assert` call. It shipped because a scan of every plan in dusk
 * found no file it would refuse.
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const inputs = { runTests: passingRun(), readSignals: upheldSignals() };

describe("A29 — a clause test that asserts nothing is refused at close", () => {
	it("refuses the file, naming the clause and the file", async () => {
		fixture = clausePlanProject({
			testText: { "a-clause": clauseTestFile("a-clause", 'it("holds", () => {});') },
		});
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			...inputs,
		});
		expect(r.ok).toBe(false);
		const text = r.ok ? "" : r.refusals.map((x) => x.message).join("\n");
		expect(text).toMatch(/a-clause/);
		expect(text).toMatch(/src\/a-clause\.test\.ts/);
		expect(text).toMatch(/asserts nothing/);
	});

	// A37 (Build Phase 7, falsification): only a real assertion call counts —
	// not the name `assert` in an import, nor the word in a comment.
	it.each([
		[
			"an imported assert and an empty test",
			[
				"// promise: a-promise",
				"// clause: a-promise/a-clause",
				'import { assert, it } from "vitest";',
				'it("holds", () => {});',
				"",
			].join("\n"),
		],
		[
			"the word in a comment and an empty test",
			[
				"// promise: a-promise",
				"// clause: a-promise/a-clause",
				'import { it } from "vitest";',
				"// we assert nothing yet; expect(this) to be written",
				'it("holds", () => {});',
				"",
			].join("\n"),
		],
		[
			"the word in a block comment",
			[
				"// promise: a-promise",
				"// clause: a-promise/a-clause",
				'import { it } from "vitest";',
				"/* assert(later) */",
				'it("holds", () => {});',
				"",
			].join("\n"),
		],
	])("A37 — refuses %s as asserting nothing", async (_label, text) => {
		fixture = clausePlanProject({ testText: { "a-clause": text } });
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			...inputs,
		});
		expect(r.ok).toBe(false);
		const message = r.ok ? "" : r.refusals.map((x) => x.message).join("\n");
		expect(message).toMatch(/src\/a-clause\.test\.ts carries the clause's token and asserts nothing/);
	});

	it("A37 — still accepts expect( and assert.<name>( and assert( calls", async () => {
		for (const body of [
			'it("holds", () => expect(1).toBe(1));',
			'it("holds", () => assert.ok(true));',
			'it("holds", () => assert(true));',
		]) {
			fixture = clausePlanProject({ testText: { "a-clause": clauseTestFile("a-clause", body) } });
			const r = await confirmPlan({
				planRoot: fixture.planRoot,
				codeRoot: fixture.codeRoot,
				plan: PLAN,
				...inputs,
			});
			expect(r.ok ? [] : r.refusals.map((x) => x.message), body).toEqual([]);
			rmSync(fixture.root, { recursive: true, force: true });
			fixture = null;
		}
	});

	it("accepts an assert call as well as expect", async () => {
		fixture = clausePlanProject({
			testText: {
				"a-clause": clauseTestFile("a-clause", 'it("holds", () => assert.equal(1, 1));'),
			},
		});
		const r = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			...inputs,
		});
		expect(r.ok ? [] : r.refusals.map((x) => x.message)).toEqual([]);
	});
});
