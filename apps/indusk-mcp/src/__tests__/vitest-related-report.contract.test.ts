import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * clause: a-plan-runs-its-tests-and-what-must-not-break/what-its-changes-reach
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 *
 * T3 of tests-never-make-us-wait. A plan's test set takes the tests its changes
 * reach from Vitest's own related run, read out of its JSON report. That is a
 * contract with a tool we do not own: if a Vitest release stops naming the test
 * files it ran there (or names them relative, or by another key), the plan's
 * set silently shrinks. System tier — it starts a Vitest process.
 */

const vitestBin = join(
	dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
	"vitest.mjs",
);

interface Report {
	testResults: Array<{ name: string }>;
}

describe("vitest related reports the test files it ran (T3)", () => {
	let dir = "";
	let report: Report;

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "vitest-related-"));
		mkdirSync(join(dir, "src"));
		writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
		writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n");
		// Globals, so the temporary package needs no `vitest` of its own to import.
		writeFileSync(
			join(dir, "src/a.test.ts"),
			`import { a } from "./a";\ntest("a", () => expect(a).toBe(1));\n`,
		);
		writeFileSync(join(dir, "src/b.test.ts"), `test("b", () => expect(1).toBe(1));\n`);
		const out = join(dir, "report.json");
		const run = spawnSync(
			process.execPath,
			[
				vitestBin,
				"related",
				"src/a.ts",
				"--run",
				"--globals",
				"--reporter=json",
				`--outputFile.json=${out}`,
			],
			{ cwd: dir, encoding: "utf-8", timeout: 100_000 },
		);
		expect(run.status, `vitest related exited ${run.status}:\n${run.stderr}${run.stdout}`).toBe(0);
		report = JSON.parse(readFileSync(out, "utf-8")) as Report;
	}, 120_000);

	afterAll(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	it("names, by absolute path, the test that imports the changed file", () => {
		const names = report.testResults.map((r) => r.name);
		expect(names.map((n) => n.replace(/^.*\//, ""))).toContain("a.test.ts");
		expect(names.every((n) => n.startsWith("/"))).toBe(true);
	});

	it("does not name a test that does not reach the changed file", () => {
		expect(report.testResults.map((r) => r.name.replace(/^.*\//, ""))).not.toContain("b.test.ts");
	});
});
