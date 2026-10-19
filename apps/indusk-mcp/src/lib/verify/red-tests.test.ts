import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseTrajectory } from "../trajectory/parser.js";
import { detectRedTests } from "./red-tests.js";
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

describe("A17 — an unresolvable test reference is unverified, not failing", () => {
	// Found by pointing verify at its OWN plan: 16 false `red-test` findings
	// while every referenced test passed. The command runs with cwd = repo root
	// and the rows named package-relative paths, so every file "failed" by not
	// existing. Reporting a failure you never observed is the same lie as
	// reporting a pass you never observed — just in the other direction.
	it("reports unverified naming the unresolvable path, never a red test", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([{ id: "A1", test: "does/not/exist.test.js", state: "passing" }]),
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "red-test")).toEqual([]);
		expect(report.unverifiedRows).toContain("A1");
	});

	it("still reports a genuine failure when the file does exist", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([{ id: "A1", test: "tests/parse.test.js", state: "passing" }]),
			files: { "tests/parse.test.js": nodeTestScript(false) },
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		// The fix must not make red-test detection toothless.
		expect(report.findings.filter((f) => f.kind === "red-test")).toHaveLength(1);
	});
});

describe("A18 — a manually-verified artifact is not shelled to a test runner", () => {
	// A16's reference is `matrix.md`, an acceptance record. There was no way for
	// a row to say "a human verified this", so it was executed and reported red.
	it("reports it as unverified rather than running it", async () => {
		const fixture = await makeVerifyFixture({
			impl: implWithTests([
				{ id: "A1", test: "manual: .indusk/planning/demo/matrix.md", state: "passing" },
			]),
			files: { ".indusk/planning/demo/matrix.md": "# acceptance record\n" },
		});
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "red-test")).toEqual([]);
		expect(report.unverifiedRows).toContain("A1");
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

describe("T20 — a system-tier test file runs the way the plan's test set runs it", () => {
	// A file in a package's system tier is not a project of the root config, so
	// run from the repository root it reads as failing. A regression guard after
	// this plan moved about 190 files to the system tier.
	it("runs it in its own package under the system config, and a pass is not reported red", async () => {
		const root = await mkdtemp(join(tmpdir(), "red-tests-system-"));
		roots.push(root);
		const files: Record<string, string> = {
			".indusk/config.json": JSON.stringify({ verify: { testCommand: "npx vitest run" } }),
			"pkg/vitest.config.ts": "export default {};\n",
			"pkg/vitest.system.config.ts": "export default {};\n",
			"pkg/vitest.tiers.ts": 'export const system = ["src/slow.test.ts"];\n',
			"pkg/src/slow.test.ts": "// a system-tier test\n",
		};
		for (const [path, content] of Object.entries(files)) {
			await mkdir(join(root, path, ".."), { recursive: true });
			await writeFile(join(root, path), content, "utf8");
		}
		const trajectory = parseTrajectory(
			implWithTests([{ id: "T1", test: "pkg/src/slow.test.ts", state: "passing" }]),
		);
		const calls: Array<{ args: string[]; cwd: string }> = [];

		const result = await detectRedTests({
			root,
			trajectory,
			phase: 1,
			run: async (_command, args, cwd) => {
				calls.push({ args, cwd });
				return { code: 0, output: "" };
			},
		});

		expect(calls).toHaveLength(1);
		expect(calls[0].cwd).toBe(join(root, "pkg"));
		expect(calls[0].args).toEqual(expect.arrayContaining(["--config", "vitest.system.config.ts"]));
		expect(calls[0].args).toContain("src/slow.test.ts");
		expect(result.findings).toEqual([]);
	});
});
