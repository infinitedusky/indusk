import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { runVerify } from "./verify.js";
import { buildImpl, makeVerifyFixture, nodeTestScript } from "./verify.test-support.js";

/**
 * A4, A13, A14 (dawn-verify) — red-test detection and its honesty requirement.
 *
 * This closes the gap the research turned up: nothing in InDusk has ever run a
 * test as part of gate enforcement, so `passing` in the State column has always
 * been an unverified self-report. Attribution is runner-agnostic on purpose —
 * the command comes from the project's own config and the verdict is the file's
 * exit code, never a parsed report format.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

function implWithTests(rows: Array<{ id: string; test?: string; state: string }>): string {
	return buildImpl({
		withTestColumn: true,
		rows: rows.map((r) => ({
			id: r.id,
			asserts: `${r.id} holds`,
			test: r.test,
			writableAt: 1,
			passesAt: 1,
			state: r.state,
		})),
		phases: [
			{
				n: 1,
				name: "Build",
				items: [[true, "build the thing"]],
				verification: [[true, `${rows.map((r) => r.id).join(", ")} pass`]],
			},
		],
	});
}

describe("A4 — a row claiming passing whose test actually fails", () => {
	it("rejects, naming the row and the failure", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([{ id: "A1", test: "tests/parse.test.js", state: "passing" }]),
			files: { "tests/parse.test.js": nodeTestScript(false) },
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("rejected");
		const finding = report.findings.find((f) => f.kind === "red-test");
		expect(finding).toBeDefined();
		expect(finding?.row).toBe("A1");
		expect(finding?.message).toContain("tests/parse.test.js");
	});

	it("stays clean when the referenced test actually passes", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([{ id: "A1", test: "tests/parse.test.js", state: "passing" }]),
			files: { "tests/parse.test.js": nodeTestScript(true) },
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "red-test")).toEqual([]);
		expect(report.verdict).toBe("clean");
	});

	it("attributes a shared file's failure to every row referencing it", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([
				{ id: "A1", test: "tests/shared.test.js", state: "passing" },
				{ id: "A2", test: "tests/shared.test.js", state: "passing" },
			]),
			files: { "tests/shared.test.js": nodeTestScript(false) },
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		const rows = report.findings.filter((f) => f.kind === "red-test").map((f) => f.row);
		expect(rows).toEqual(expect.arrayContaining(["A1", "A2"]));
	});
});

describe("A13 — a passing row with no test reference is unverified, not verified", () => {
	it("reports it as unverified rather than folding it into checked-and-passed", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([
				{ id: "A1", test: "tests/parse.test.js", state: "passing" },
				{ id: "A2", state: "passing" },
			]),
			files: { "tests/parse.test.js": nodeTestScript(true) },
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.unverifiedRows).toContain("A2");
		expect(report.unverifiedRows).not.toContain("A1");
	});
});

describe("A14 — a plan authored before test references still verifies", () => {
	it("verifies without error and reports how many rows could not be red-test-checked", async () => {
		// No `Test` column at all — the shape of every plan already in the repo.
		const impl = buildImpl({
			rows: [
				{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
				{ id: "A2", asserts: "the widget renders", writableAt: 1, passesAt: 1, state: "passing" },
			],
			phases: [
				{
					n: 1,
					name: "Build",
					items: [[true, "build the thing"]],
					verification: [[true, "A1, A2 pass"]],
				},
			],
		});
		const fixture = await makeVerifyFixture({ impl });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("clean");
		expect(report.unverifiedRows).toEqual(expect.arrayContaining(["A1", "A2"]));
	});
});
