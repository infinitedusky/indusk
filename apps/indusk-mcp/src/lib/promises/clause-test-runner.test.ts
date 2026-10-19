import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	PLAN,
	testOf,
	upheldSignals,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import type { Runner } from "../tests/run-files.js";
import { clauseTestRunner } from "./closing-inputs.js";
import { confirmPlan } from "./confirm.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/verified-before-release

/**
 * A36 of mark-first (Build Phase 7, falsification): a clause's test file whose
 * every test was skipped (`describe.skipIf`, `it.skip`, `it.todo`) is not
 * passing when closing or landing runs it. Vitest's JSON report marks such a
 * file `passed`; only its tests' statuses say nothing ran. The tests half
 * refuses it as "ran no test".
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

/** The fixture project, with Vitest named as its test runner. */
function project(): PromiseProject {
	const p = clausePlanProject();
	const config = join(p.planRoot, ".indusk", "config.json");
	const parsed = JSON.parse(readFileSync(config, "utf-8"));
	writeFileSync(config, JSON.stringify({ ...parsed, verify: { testRunner: { tool: "vitest" } } }));
	fixture = p;
	return p;
}

/**
 * A Vitest stand-in: writes the JSON report Vitest 4 writes, with each file's
 * tests at the statuses given. A file's own status is `passed` unless a test
 * failed — what the real reporter does for a file whose tests were all skipped.
 */
function vitestReporting(statuses: Record<string, string[]>): Runner {
	return async (_command, args, cwd) => {
		const out = args.find((a) => a.startsWith("--outputFile.json="))?.slice(18);
		if (!out) throw new Error("no JSON report was asked for");
		const testResults = Object.entries(statuses).map(([file, tests]) => ({
			name: resolve(cwd, file),
			status: tests.includes("failed") ? "failed" : "passed",
			assertionResults: tests.map((status, i) => ({ title: `t${i}`, status })),
		}));
		writeFileSync(out, JSON.stringify({ testResults }));
		return { code: testResults.some((r) => r.status === "failed") ? 1 : 0, output: "" };
	};
}

describe("A36 — a clause test whose every test was skipped is not passing", () => {
	it("a file whose tests were all skipped or todo is not passed", async () => {
		const p = project();
		const run = clauseTestRunner(
			p.planRoot,
			p.codeRoot,
			vitestReporting({
				[testOf("a-clause")]: ["skipped", "skipped"],
				[testOf("b-clause")]: ["todo"],
			}),
		);
		const results = await run([testOf("a-clause"), testOf("b-clause")]);
		expect(results.map((r) => [r.file, r.passed])).toEqual([
			[testOf("a-clause"), false],
			[testOf("b-clause"), false],
		]);
	});

	it("a file with one test that ran and passed is passed, skipped neighbours or not", async () => {
		const p = project();
		const run = clauseTestRunner(
			p.planRoot,
			p.codeRoot,
			vitestReporting({ [testOf("a-clause")]: ["skipped", "passed"] }),
		);
		const [result] = await run([testOf("a-clause")]);
		expect(result?.passed).toBe(true);
	});

	it("closing refuses the clause whose test ran nothing, saying so", async () => {
		const p = project();
		const r = await confirmPlan({
			planRoot: p.planRoot,
			codeRoot: p.codeRoot,
			plan: PLAN,
			runTests: clauseTestRunner(
				p.planRoot,
				p.codeRoot,
				vitestReporting({
					[testOf("a-clause")]: ["skipped"],
					[testOf("b-clause")]: ["passed"],
				}),
			),
			readSignals: upheldSignals(),
		});
		expect(r.ok, "a clause whose only test was skipped closed").toBe(false);
		const text = r.ok ? "" : r.refusals.map((x) => x.message).join("\n");
		expect(text).toMatch(
			/a-promise\/a-clause: tests — src\/a-clause\.test\.ts ran no test \(skipped\)/,
		);
		expect(text).not.toMatch(/b-clause/);
	});
});
