import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * release-records-its-failures, Test Phase 1 — A8 (contract, system tier):
 * dusk's slow tests, run with the reporter its system config declares, write
 * a JUnit report whose failed cases name the test files that failed.
 *
 * promise: a-failure-is-read-from-the-report
 *
 * The question is about vitest, which dusk does not own: does its `junit`
 * reporter still name a failing file the way the reader (`lib/release/junit.ts`,
 * ADR D4) expects. So this runs the real vitest on a tiny fixture test that
 * fails, under the reporter settings of `vitest.system.config.ts` and nothing
 * else of it: a generated config imports dusk's and carries over only
 * `test.reporters` and `test.outputFile`. A system config that declares no
 * reporter writes no report, which is the red today.
 */

const PACKAGE = resolve(__dirname, "../..");
const VITEST = join(
	dirname(createRequire(__filename).resolve("vitest/package.json")),
	"vitest.mjs",
);

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("A8 — vitest's JUnit report names the failing file, under dusk's declared reporter", () => {
	it("a failing fixture test leaves a report at the declared path with a failed case for that file", () => {
		dir = mkdtempSync(join(tmpdir(), "release-junit-"));
		writeFileSync(
			join(dir, "fail.test.ts"),
			'it("fails on purpose", () => {\n\tthrow new Error("boom");\n});\n',
		);
		mkdirSync(join(dir, "out"));
		writeFileSync(
			join(dir, "vitest.config.mjs"),
			[
				`import dusk from ${JSON.stringify(join(PACKAGE, "vitest.system.config.ts"))};`,
				`import { writeFileSync } from "node:fs";`,
				"const declared = dusk.test ?? {};",
				`writeFileSync(${JSON.stringify(join(dir, "out/declared.json"))}, JSON.stringify({ reporters: declared.reporters ?? null, outputFile: declared.outputFile ?? null }));`,
				"export default {",
				"\ttest: {",
				'\t\tinclude: ["fail.test.ts"],',
				"\t\tglobals: true,",
				"\t\treporters: declared.reporters,",
				"\t\toutputFile: declared.outputFile,",
				"\t},",
				"};",
				"",
			].join("\n"),
		);
		const run = spawnSync(
			"node",
			[VITEST, "run", "--root", dir, "--config", join(dir, "vitest.config.mjs")],
			{
				cwd: dir,
				encoding: "utf-8",
			},
		);
		expect(run.status, `the fixture test should fail\n${run.stdout}\n${run.stderr}`).not.toBe(0);
		expect(existsSync(join(dir, "out/declared.json")), `config did not load\n${run.stderr}`).toBe(
			true,
		);

		const declared = JSON.parse(readFileSync(join(dir, "out/declared.json"), "utf-8")) as {
			reporters: unknown;
			outputFile: string | Record<string, string> | null;
		};
		expect(
			JSON.stringify(declared.reporters),
			"vitest.system.config.ts declares no junit reporter",
		).toContain("junit");
		const out =
			typeof declared.outputFile === "string" ? declared.outputFile : declared.outputFile?.junit;
		expect(out, "vitest.system.config.ts declares no outputFile for the junit report").toBeTypeOf(
			"string",
		);

		const report = join(dir, out as string);
		expect(existsSync(report), `no report at the declared path ${out}`).toBe(true);
		const xml = readFileSync(report, "utf-8");
		expect(xml, "a failed case for the fixture file").toMatch(
			/<testcase[^>]*classname="[^"]*fail\.test\.ts"[^>]*>\s*<failure/,
		);
	});
});
